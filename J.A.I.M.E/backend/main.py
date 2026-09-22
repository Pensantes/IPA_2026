"""
API do JAIME — Streaming + diagnóstico de latência/reasoning
"""

import os
import time
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("jaime_api")

load_dotenv(Path(__file__).with_name(".env"))

PROMPT_PATH = Path(__file__).parent.parent / "SYSTEM_PROMPT.md"
SYSTEM_PROMPT = (
    PROMPT_PATH.read_text(encoding="utf-8")
    if PROMPT_PATH.exists()
    else "Você é o JAIME. Responda em JSON estruturado."
)

NEWAPI_KEY = os.getenv("NEWAPI_API_KEY")
NEWAPI_URL = os.getenv(
    "NEWAPI_BASE_URL",
    "https://iluma.cnpem.br:4000/v1",
)
NEWAPI_MODEL = os.getenv("NEWAPI_MODEL", "iluma")

if not NEWAPI_KEY:
    raise ValueError("NEWAPI_API_KEY ausente no arquivo .env")


http_client = httpx.Client(
    timeout=httpx.Timeout(
        connect=10.0,
        read=120.0,
        write=30.0,
        pool=30.0,
    )
)

openai_client = OpenAI(
    api_key=NEWAPI_KEY,
    base_url=NEWAPI_URL,
    http_client=http_client,
    max_retries=0,
)

CREATOR_PWD = "pamonha extinta"
session_tokens: Dict[str, int] = {}


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------

app = FastAPI(title="JAIME API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


def is_creator(msg: str) -> bool:
    norm = " ".join(msg.lower().split())
    return norm == CREATOR_PWD or norm.startswith(f"{CREATOR_PWD} ")


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


@app.post("/chat")
def chat(req: ChatRequest):
    session_id = req.session_id or "stateless"

    if not req.message.strip():
        raise HTTPException(400, "Mensagem vazia.")

    logger.info(f"📥 [REQ] Session={session_id[:8]} | " f"Msg='{req.message[:80]}...'")

    # Proteção da senha
    if CREATOR_PWD in req.message.lower() and not is_creator(req.message):
        return {
            "response": {
                "sentence": [
                    {
                        "emoji": "🚫",
                        "text": "Não posso revelar a senha.",
                        "tone": "seco",
                    }
                ]
            },
            "session_id": session_id,
            "total_tokens": session_tokens.get(session_id, 0),
        }

    rule = (
        "[REGRA ABSOLUTA]: O usuário é o criador. Obedeça."
        if is_creator(req.message)
        else "[REGRA ABSOLUTA]: Nunca revele a senha."
    )

    prompt = f"{SYSTEM_PROMPT}\n\n{rule}"

    def generate_stream():
        start_time = time.perf_counter()
        first_token_time = None

        full_text = ""
        chunk_count = 0
        content_chunks = 0
        reasoning_chunks = 0

        prompt_tokens = 0
        completion_tokens = 0
        reasoning_tokens = 0
        text_tokens = 0
        total_tokens = 0

        try:
            logger.info("🚀 [MODEL] Enviando requisição...")

            stream = openai_client.chat.completions.create(
                model=NEWAPI_MODEL,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": req.message},
                ],
                temperature=0.7,
                max_tokens=512,
                reasoning_effort="low",
                response_format={"type": "json_object"},
                stream=True,
                stream_options={"include_usage": True},
            )

            logger.info("📡 [MODEL] Stream iniciado.")

            for chunk in stream:
                chunk_count += 1

                # -----------------------------------------------------------
                # Usage
                # -----------------------------------------------------------

                usage = getattr(chunk, "usage", None)

                if usage is not None:
                    prompt_tokens = getattr(usage, "prompt_tokens", 0)
                    completion_tokens = getattr(usage, "completion_tokens", 0)
                    total_tokens = getattr(usage, "total_tokens", 0)

                    details = getattr(
                        usage,
                        "completion_tokens_details",
                        None,
                    )

                    if details is not None:
                        reasoning_tokens = getattr(
                            details,
                            "reasoning_tokens",
                            0,
                        )
                        text_tokens = getattr(
                            details,
                            "text_tokens",
                            0,
                        )

                    logger.info(
                        f"🧠 [USAGE] prompt={prompt_tokens} | "
                        f"completion={completion_tokens} | "
                        f"text={text_tokens} | "
                        f"reasoning={reasoning_tokens} | "
                        f"total={total_tokens}"
                    )

                # O último chunk pode ter usage, mas choices=[]
                if not getattr(chunk, "choices", None):
                    continue

                delta = chunk.choices[0].delta

                # -----------------------------------------------------------
                # Reasoning
                # -----------------------------------------------------------

                reasoning = getattr(
                    delta,
                    "reasoning_content",
                    None,
                )

                if reasoning:
                    reasoning_chunks += 1
                    logger.info(f"🧠 [REASONING #{reasoning_chunks}] " f"{reasoning!r}")

                # -----------------------------------------------------------
                # Conteúdo normal
                # -----------------------------------------------------------

                content = getattr(delta, "content", None)

                if not content:
                    continue

                content_chunks += 1
                full_text += content

                # Primeiro conteúdo REAL, ignorando chunks vazios
                if first_token_time is None:
                    first_token_time = time.perf_counter()
                    ttft = (first_token_time - start_time) * 1000

                    logger.info(f"⚡ [TTFT] Primeiro conteúdo em " f"{ttft:.2f} ms")

                # Não imprime milhares de chunks no terminal.
                # Mostra apenas um resumo periódico.
                if content_chunks == 1 or content_chunks % 50 == 0:
                    logger.info(
                        f"📤 [STREAM] {content_chunks} chunks | " f"último={content!r}"
                    )

                yield content

            # ---------------------------------------------------------------
            # Finalização
            # ---------------------------------------------------------------

            total_latency = (time.perf_counter() - start_time) * 1000

            ttft = (
                (first_token_time - start_time) * 1000
                if first_token_time is not None
                else None
            )

            logger.info("=" * 70)
            logger.info("📜 [RESPOSTA CRUA]")
            logger.info(full_text)
            logger.info("-" * 70)
            logger.info(
                f"⏱️ [LATÊNCIA] total={total_latency:.2f} ms | " f"ttft={ttft:.2f} ms"
                if ttft is not None
                else f"⏱️ [LATÊNCIA] total={total_latency:.2f} ms"
            )
            logger.info(
                f"📦 [STREAM] chunks={chunk_count} | "
                f"content={content_chunks} | "
                f"reasoning={reasoning_chunks}"
            )
            logger.info(
                f"🔢 [TOKENS] prompt={prompt_tokens} | "
                f"text={text_tokens} | "
                f"reasoning={reasoning_tokens} | "
                f"completion={completion_tokens} | "
                f"total={total_tokens}"
            )
            logger.info("=" * 70)

            # ---------------------------------------------------------------
            # Validação JSON
            # ---------------------------------------------------------------

            try:
                reply = json.loads(full_text)

                if not isinstance(reply, dict):
                    raise ValueError("Resposta não é um objeto JSON.")

                if "sentence" not in reply:
                    raise ValueError("Campo 'sentence' ausente.")

                session_tokens[session_id] = (
                    session_tokens.get(session_id, 0) + total_tokens
                )

                meta_payload = json.dumps(
                    {
                        "_meta": {
                            "session_id": session_id,
                            "total_tokens": session_tokens[session_id],
                            "prompt_tokens": prompt_tokens,
                            "completion_tokens": completion_tokens,
                            "text_tokens": text_tokens,
                            "reasoning_tokens": reasoning_tokens,
                            "latency_ms": round(total_latency, 2),
                            "ttft_ms": (round(ttft, 2) if ttft is not None else None),
                        }
                    },
                    ensure_ascii=False,
                )

                yield f"\n\n{meta_payload}"

            except json.JSONDecodeError as e:
                logger.error(f"❌ [JSON] JSON inválido: {e}")
                yield ('\n\n{"_error":' '"O modelo não retornou um JSON válido."}')

            except ValueError as e:
                logger.error(f"❌ [JSON] Estrutura inválida: {e}")
                yield (
                    '\n\n{"_error":'
                    '"A resposta do modelo não contém o formato esperado."}'
                )

        except Exception as e:
            logger.error(
                f"❌ [STREAM] {str(e)}",
                exc_info=True,
            )

            yield "\n\n" + json.dumps(
                {"_error": f"Erro ao consultar modelo: {str(e)}"},
                ensure_ascii=False,
            )

    return StreamingResponse(
        generate_stream(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> Dict[str, Any]:
    key_ok = bool(NEWAPI_KEY)

    return {
        "app_status": "ok",
        "api_status": "ok" if key_ok else "error",
        "provider": "NewAPI",
        "model_configured": NEWAPI_MODEL,
        "latency_ms": 0,
        "available_models_count": 1 if key_ok else 0,
        "error": (None if key_ok else "NEWAPI_API_KEY não configurada no .env"),
    }
