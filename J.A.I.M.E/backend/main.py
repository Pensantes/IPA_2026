"""
API do JAIME — Streaming + TTS com Piper + Logs Detalhados de Diagnóstico
"""

import io
import os
import time
import json
import logging
import wave
import re
from pathlib import Path
from typing import Optional, Dict, Any
from num2words import num2words

import httpx
import piper
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
NEWAPI_URL = os.getenv("NEWAPI_BASE_URL", "https://iluma.cnpem.br:4000/v1")
NEWAPI_MODEL = os.getenv("NEWAPI_MODEL", "iluma")

if not NEWAPI_KEY:
    raise ValueError("NEWAPI_API_KEY ausente no arquivo .env")

http_client = httpx.Client(
    timeout=httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=30.0)
)
openai_client = OpenAI(
    api_key=NEWAPI_KEY, base_url=NEWAPI_URL, http_client=http_client, max_retries=0
)

CREATOR_PWD = "pamonha extinta"
session_tokens: Dict[str, int] = {}
MAX_JSON_RETRIES = 2

# ---------------------------------------------------------------------------
# Piper TTS com Logs Detalhados
# ---------------------------------------------------------------------------
_piper_voice = None


def resolve_piper_model() -> str:
    configured = os.getenv("PIPER_MODEL", "").strip()
    if configured and os.path.exists(configured):
        return configured
    candidate = Path(__file__).resolve().parent / "voices" / "pt_BR-faber-medium.onnx"
    if candidate.exists():
        return str(candidate)

    logger.error(
        "❌ [TTS INIT] Arquivo .onnx não encontrado no caminho padrão ou no .env"
    )
    raise RuntimeError(
        "Piper model não encontrado. Defina PIPER_MODEL no .env ou coloque o arquivo em backend/voices/"
    )


def resolve_piper_config(model_path: str) -> Optional[str]:
    configured = os.getenv("PIPER_CONFIG", "").strip()
    if configured and os.path.exists(configured):
        return configured
    default_config = Path(model_path).with_suffix(".json")
    return str(default_config) if default_config.exists() else None


def get_piper_voice():
    global _piper_voice
    if _piper_voice is None:
        model_path = resolve_piper_model()
        config_path = resolve_piper_config(model_path)
        logger.info(f"🔊 [TTS INIT] Carregando modelo: {model_path}")
        logger.info(f"⚙️ [TTS INIT] Usando config: {config_path or 'Padrão (None)'}")

        try:
            _piper_voice = piper.PiperVoice.load(model_path, config_path=config_path)
            logger.info("✅ [TTS INIT] Modelo Piper carregado na memória com sucesso.")
        except Exception as e:
            logger.error(
                f"❌ [TTS INIT] Falha crítica ao carregar modelo Piper: {e}",
                exc_info=True,
            )
            raise RuntimeError(f"Falha ao carregar modelo Piper: {e}")

    return _piper_voice


def normalize_text_for_tts(text: str) -> str:
    logger.debug(f"🧹 [TTS NORM] Entrada original: '{text}'")

    # Remove URLs
    text = re.sub(r"https?://\S+", "", text)

    def number_to_words(match):
        num = match.group(0)
        try:
            n = int(num)
            return num2words(n, lang="pt_BR")
        except Exception:
            return num

    text = re.sub(r"\b\d+\b", number_to_words, text)
    text = text.replace("%", " por cento")
    text = text.replace("&", " e ")
    text = text.replace("@", " arroba ")
    text = text.replace("#", " hashtag ")

    # Remove caracteres problemáticos (mantém letras, números, espaços e pontuação básica)
    # text = re.sub(r"[^\w\s.,!?;:()-]", "", text)
    text = re.sub(r"\bCNPEM\b", "CENIPÊM", text, flags=re.IGNORECASE)
    text = re.sub(r"\bRASPILUM\b", "RASPÍLUM", text, flags=re.IGNORECASE)

    final_text = text.strip()
    logger.debug(f"🧹 [TTS NORM] Saída limpa: '{final_text}'")
    return final_text


def synthesize_piper_audio(
    text: str,
    length_scale: float = 1.2,
    noise_scale: float = 0.130,
    noise_w: float = 0.21,
) -> bytes:
    normalized = normalize_text_for_tts(text)
    clean_text = " ".join(normalized.split())

    if not clean_text:
        logger.error(
            "❌ [TTS SYNTH] O texto ficou completamente vazio após a normalização."
        )
        raise ValueError("Texto vazio após normalização.")

    logger.info(
        f"🗣️ [TTS SYNTH] Enviando: '{clean_text[:50]}...' | Params: L={length_scale}, NS={noise_scale}, NW={noise_w}"
    )

    voice = get_piper_voice()
    buffer = io.BytesIO()

    try:
        # Cria o objeto de configuração de síntese com os parâmetros
        syn_config = piper.SynthesisConfig(
            length_scale=length_scale, noise_scale=noise_scale, noise_w_scale=noise_w
        )

        with wave.open(buffer, "wb") as wav_file:
            # Configuração obrigatória do cabeçalho WAV
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(voice.config.sample_rate)

            # CORREÇÃO: Passa o syn_config como parâmetro único
            voice.synthesize_wav(
                text=clean_text,
                wav_file=wav_file,
                syn_config=syn_config,
                set_wav_format=True,
                include_alignments=False,
            )

        logger.info("✅ [TTS SYNTH] Síntese concluída com sucesso.")
    except Exception as e:
        logger.error(
            f"❌ [TTS SYNTH] Erro durante a chamada ao motor Piper: {e}", exc_info=True
        )
        raise

    return buffer.getvalue()


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="JAIME API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class TTSRequest(BaseModel):
    text: str
    length_scale: float = 1.0
    noise_scale: float = 0.667
    noise_w: float = 0.8


def is_creator(msg: str) -> bool:
    norm = " ".join(msg.lower().split())
    return norm == CREATOR_PWD or norm.startswith(f"{CREATOR_PWD} ")


@app.post("/chat")
def chat(req: ChatRequest):
    session_id = req.session_id or "stateless"
    if not req.message.strip():
        raise HTTPException(400, "Mensagem vazia.")
    logger.info(f"📥 [REQ] Session={session_id[:8]} | Msg='{req.message[:80]}...'")

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
        fallback_response = {
            "sentence": [
                {
                    "emoji": "⚠️",
                    "text": "Desculpe, tive um pequeno problema de conexão com o laboratório. Pode repetir?",
                    "tone": "seco",
                }
            ]
        }

        for attempt in range(1, MAX_JSON_RETRIES + 1):
            logger.info(f"🔄 [TENTATIVA] {attempt} de {MAX_JSON_RETRIES}")
            start_time = time.perf_counter()
            full_text = ""
            total_tokens = 0

            try:
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
                    timeout=10000,
                )

                for chunk in stream:
                    usage = getattr(chunk, "usage", None)
                    if usage is not None:
                        total_tokens = getattr(usage, "total_tokens", 0)

                    if not getattr(chunk, "choices", None):
                        continue
                    content = getattr(chunk.choices[0].delta, "content", None)
                    if content:
                        full_text += content

                logger.info(
                    f"📜 [RAW RESPONSE] Len={len(full_text)} | Content: {full_text[:100]}..."
                )

                if not full_text.strip():
                    raise ValueError("Resposta completamente vazia do proxy.")

                reply = json.loads(full_text)
                if not isinstance(reply, dict) or "sentence" not in reply:
                    raise ValueError(
                        f"Estrutura inválida. Chaves: {list(reply.keys())}"
                    )

                logger.info(f"✅ [SUCESSO] JSON válido na tentativa {attempt}.")
                yield full_text

                session_tokens[session_id] = (
                    session_tokens.get(session_id, 0) + total_tokens
                )
                meta_payload = json.dumps(
                    {
                        "_meta": {
                            "session_id": session_id,
                            "total_tokens": session_tokens[session_id],
                            "latency_ms": round(
                                (time.perf_counter() - start_time) * 1000, 2
                            ),
                            "attempts": attempt,
                        }
                    },
                    ensure_ascii=False,
                )
                yield f"\n\n{meta_payload}"
                return

            except Exception as e:
                logger.warning(f"⚠️ [FALHA TENTATIVA {attempt}] {str(e)}")
                if attempt == MAX_JSON_RETRIES:
                    logger.error(
                        "❌ [FALLBACK] Esgotadas tentativas. Enviando resposta de segurança."
                    )
                    yield json.dumps(fallback_response, ensure_ascii=False)
                    yield '\n\n{"_meta": {"session_id": "' + session_id + '", "total_tokens": 0, "fallback": true}}'
                    return

    return StreamingResponse(
        generate_stream(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/tts")
def tts(req: TTSRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "Texto vazio.")

    try:
        start_time = time.perf_counter()
        audio_bytes = synthesize_piper_audio(
            text,
            length_scale=req.length_scale,
            noise_scale=req.noise_scale,
            noise_w=req.noise_w,
        )
        duration_ms = (time.perf_counter() - start_time) * 1000

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": 'inline; filename="jaime.wav"',
                "Cache-Control": "no-cache",
            },
        )
    except ValueError as ve:
        raise HTTPException(400, str(ve)) from ve
    except Exception as exc:
        logger.error(f"❌ [TTS ERR] Falha catastrófica: {str(exc)}", exc_info=True)
        raise HTTPException(503, f"Falha na síntese: {str(exc)}") from exc


@app.get("/health")
def health() -> Dict[str, Any]:
    """
    Health check real: testa a conexão com a API e verifica se o modelo configurado está disponível.
    Usa httpx direto para evitar bugs de validação Pydantic do proxy NewAPI.
    """
    health_status = {
        "app_status": "ok",
        "api_status": "unknown",
        "provider": "NewAPI",
        "model_configured": NEWAPI_MODEL,
        "latency_ms": None,
        "available_models_count": 0,
        "error": None,
    }

    if not NEWAPI_KEY:
        health_status["api_status"] = "error"
        health_status["error"] = "NEWAPI_API_KEY não configurada no .env"
        return health_status

    try:
        start_time = time.time()

        # Garante que a URL termine corretamente para /models
        base_url = NEWAPI_URL.rstrip("/")
        models_url = (
            f"{base_url}/models"
            if base_url.endswith("/v1")
            else f"{base_url}/v1/models"
        )

        with httpx.Client() as client:
            response = client.get(
                models_url,
                headers={"Authorization": f"Bearer {NEWAPI_KEY}"},
                timeout=10.0,  # Timeout curto para não travar o health check
            )
            response.raise_for_status()
            data = response.json()

        end_time = time.time()
        health_status["latency_ms"] = round((end_time - start_time) * 1000, 2)

        # Extrai a lista de modelos de forma segura
        models_list = data.get("data", [])
        health_status["available_models_count"] = len(models_list)

        # Extrai os IDs, lidando com o caso de o proxy devolver formatos estranhos
        model_ids = []
        for m in models_list:
            if isinstance(m, dict) and "id" in m:
                model_ids.append(m["id"])
            else:
                model_ids.append(str(m))

        # Verifica se o modelo que queremos usar está na lista
        if NEWAPI_MODEL not in model_ids:
            health_status["api_status"] = "warning"
            available_preview = ", ".join(model_ids[:3]) + (
                "..." if len(model_ids) > 3 else ""
            )
            health_status["error"] = (
                f"Modelo '{NEWAPI_MODEL}' não encontrado. Disponíveis: {available_preview}"
            )
        else:
            health_status["api_status"] = "ok"

    except httpx.HTTPStatusError as e:
        health_status["api_status"] = "error"
        health_status["error"] = (
            f"Erro HTTP {e.response.status_code}: {e.response.text[:150]}"
        )
    except httpx.ReadTimeout:
        health_status["api_status"] = "error"
        health_status["error"] = (
            "Timeout: O servidor da API demorou muito para responder."
        )
    except Exception as e:
        health_status["api_status"] = "error"
        health_status["error"] = f"Falha na conexão: {str(e)}"

    return health_status
