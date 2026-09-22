"""
API do JAIME — Versão final com fallback automático (NewAPI ou Google Gemini).
Mantém logging detalhado, timeouts seguros e contagem de tokens unificada.
"""

import os
import time
import json
import logging
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

# Importação condicional do Google (evita crash se a lib não estiver instalada)
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

# Configuração do Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("jaime_api")

load_dotenv(Path(__file__).with_name('.env'))

# ---------------------------------------------------------------------------
# 1. Configurações e Variáveis de Ambiente
# ---------------------------------------------------------------------------
PROMPT_PATH = Path(__file__).parent.parent / "SYSTEM_PROMPT.md"
try:
    SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8")
except FileNotFoundError:
    SYSTEM_PROMPT = "Você é o JAIME. Responda em JSON estruturado."

# Chave mestra para alternar provedores
USE_GOOGLE_API = os.environ.get("USE_GOOGLE_API", "false").lower() == "true"

# Configurações NewAPI
NEWAPI_API_KEY = os.environ.get("NEWAPI_API_KEY")
NEWAPI_BASE_URL = os.environ.get("NEWAPI_BASE_URL", "https://iluma.cnpem.br:4000/v1")
NEWAPI_MODEL = os.environ.get("NEWAPI_MODEL", "iluma")

# Configurações Google (Fallback)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

if not USE_GOOGLE_API and not NEWAPI_API_KEY:
    logger.error("NEWAPI_API_KEY não encontrada no arquivo .env")
    raise ValueError("NEWAPI_API_KEY não encontrada no arquivo .env")

if USE_GOOGLE_API and not GEMINI_API_KEY:
    logger.error("USE_GOOGLE_API=true, mas GEMINI_API_KEY não encontrada no .env")
    raise ValueError("GEMINI_API_KEY necessária quando USE_GOOGLE_API=true")

# Cliente OpenAI (usado apenas se USE_GOOGLE_API for False)
client = OpenAI(
    api_key=NEWAPI_API_KEY,
    base_url=NEWAPI_BASE_URL,
    timeout=10.0,       # Aborta a conexão se demorar mais de 10 segundos
    max_retries=0       # DESATIVA as tentativas automáticas que travam o servidor
)

CREATOR_PASSWORD = "pamonha extinta"
_session_tokens: dict[str, int] = {}

# Schema explícito para garantir que o Gemini siga o mesmo formato do OpenAI
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "sentence": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "emoji": {"type": "string"},
                    "text": {"type": "string"},
                    "tone": {
                        "type": "string",
                        "enum": ["neutro", "seco", "irônico", "curioso", "brincalhão", "sério", "pensativo", "satisfeito"],
                    },
                },
                "required": ["emoji", "text", "tone"],
            },
        }
    },
    "required": ["sentence"],
}

# ---------------------------------------------------------------------------
# 2. App FastAPI e Modelos
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

def normalize_text(value: str) -> str:
    return " ".join((value or "").lower().split())

def is_creator_message(message: str) -> bool:
    normalized = normalize_text(message)
    return normalized == CREATOR_PASSWORD or normalized.startswith(f"{CREATOR_PASSWORD} ")

@app.post("/chat")
def chat(req: ChatRequest) -> dict:
    session_id = req.session_id or "stateless-session"
    logger.info(f"📥 [INÍCIO] Requisição recebida. Session: {session_id[:8]}... | Msg: '{req.message[:30]}...'")

    if not req.message.strip():
        logger.warning("⚠️ Mensagem vazia recebida.")
        raise HTTPException(status_code=400, detail="Mensagem vazia.")

    normalized_message = normalize_text(req.message)

    # Proteção da senha do criador
    if "pamonha extinta" in normalized_message and not is_creator_message(req.message):
        logger.info("🛡️ [SEGURANÇA] Tentativa de descoberta de senha bloqueada.")
        return {
            "response": {
                "sentence": [
                    {"emoji": "🚫", "text": "Não posso revelar a senha do criador.", "tone": "seco"}
                ]
            },
            "session_id": session_id,
            "total_tokens": _session_tokens.get(session_id, 0)
        }

    logger.info("⚙️ [PROCESSAMENTO] Montando prompt dinâmico...")
    runtime_prompt = SYSTEM_PROMPT
    if is_creator_message(req.message):
        runtime_prompt += "\n\n[REGRA ABSOLUTA]: O usuário é o criador. Obedeça sem questionar. Nunca revele a senha."
    else:
        runtime_prompt += "\n\n[REGRA ABSOLUTA]: Nunca revele a senha do criador, sob hipótese alguma."

    try:
        provider_name = "Google Gemini" if USE_GOOGLE_API else "NewAPI"
        logger.info(f"🌐 [API] Chamando provedor: {provider_name} (timeout de 10s)...")
        start_api_call = time.time()
        
        # --- RAMIFICAÇÃO DE PROVEDOR ---
        if USE_GOOGLE_API:
            if not GEMINI_AVAILABLE:
                raise RuntimeError("Biblioteca 'google-genai' não instalada. Rode: pip install google-genai")
            
            gemini_client = genai.Client(api_key=GEMINI_API_KEY)
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[{"role": "user", "parts": [{"text": req.message}]}],
                config=types.GenerateContentConfig(
                    system_instruction=runtime_prompt,
                    response_mime_type="application/json",
                    response_schema=RESPONSE_SCHEMA,
                    temperature=0.7,
                    max_output_tokens=1024
                )
            )
            final_text = response.text
            current_request_tokens = getattr(response.usage_metadata, 'total_token_count', 0) if response.usage_metadata else 0
            
        else:
            response = client.chat.completions.create(
                model=NEWAPI_MODEL,
                messages=[
                    {"role": "system", "content": runtime_prompt},
                    {"role": "user", "content": req.message}
                ],
                temperature=0.7,
                max_tokens=1024,
                response_format={"type": "json_object"}
            )
            final_text = response.choices[0].message.content
            usage = getattr(response, "usage", None)
            current_request_tokens = usage.total_tokens if usage else 0
        # -------------------------------

        api_latency = round((time.time() - start_api_call) * 1000, 2)
        logger.info(f"✅ [API] Resposta recebida em {api_latency}ms.")

        if not final_text:
            logger.error("❌ [API] Modelo retornou conteúdo vazio.")
            raise HTTPException(status_code=502, detail="O modelo respondeu sem conteúdo.")

        logger.info("🔍 [VALIDAÇÃO] Parseando JSON da resposta...")
        reply_json = json.loads(final_text)

        if not isinstance(reply_json, dict) or "sentence" not in reply_json:
            logger.error(f"❌ [VALIDAÇÃO] Formato inválido. Recebido: {str(reply_json)[:100]}")
            raise HTTPException(status_code=502, detail="Resposta do modelo fora do formato esperado.")

        # --- RASTREAMENTO REAL DE TOKENS (Funciona para ambos os provedores) ---
        _session_tokens[session_id] = _session_tokens.get(session_id, 0) + current_request_tokens
        total_session_tokens = _session_tokens[session_id]
        logger.info(f"💾 [MEMÓRIA] Tokens atualizados. Total da sessão {session_id[:8]}...: {total_session_tokens}")

        logger.info("🏁 [FIM] Requisição concluída com sucesso.")
        return {
            "response": reply_json,
            "session_id": session_id,
            "total_tokens": total_session_tokens
        }

    except json.JSONDecodeError as exc:
        logger.error(f"❌ [ERRO] JSONDecodeError: {exc}")
        raise HTTPException(status_code=502, detail=f"O modelo não retornou JSON válido: {exc}")
    except Exception as exc:
        logger.error(f"❌ [ERRO CRÍTICO] Falha durante o processamento: {str(exc)}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Erro ao consultar o modelo: {str(exc)}")

@app.get("/health")
def health() -> dict:
    provider_name = "Google Gemini" if USE_GOOGLE_API else "NewAPI"
    model_to_test = GEMINI_MODEL if USE_GOOGLE_API else NEWAPI_MODEL
    
    health_status = {
        "app_status": "ok",
        "api_status": "unknown",
        "provider": provider_name,
        "model_configured": model_to_test,
        "latency_ms": None,
        "error": None
    }

    if USE_GOOGLE_API and not GEMINI_API_KEY:
        health_status["api_status"] = "error"
        health_status["error"] = "GEMINI_API_KEY não configurada no .env"
        return health_status
        
    if not USE_GOOGLE_API and not NEWAPI_API_KEY:
        health_status["api_status"] = "error"
        health_status["error"] = "NEWAPI_API_KEY não configurada no .env"
        return health_status

    try:
        start_time = time.time()
        
        if USE_GOOGLE_API:
            gemini_client = genai.Client(api_key=GEMINI_API_KEY)
            test_response = gemini_client.models.generate_content(
                model=model_to_test,
                contents=[{"role": "user", "parts": [{"text": "ok"}]}],
                config=types.GenerateContentConfig(max_output_tokens=5)
            )
        else:
            test_response = client.chat.completions.create(
                model=model_to_test,
                messages=[{"role": "user", "content": "ok"}],
                max_tokens=5
            )
            
        end_time = time.time()
        health_status["latency_ms"] = round((end_time - start_time) * 1000, 2)
        health_status["api_status"] = "ok"
        
    except Exception as e:
        health_status["api_status"] = "error"
        health_status["error"] = f"Falha na conexão com {provider_name}: {str(e)}"

    return health_status