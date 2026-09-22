"""
API do JAIME — recebe uma mensagem do visitante e devolve a resposta
gerada pelo modelo, usando o system prompt do JAIME.

Rodar localmente:
    uvicorn main:app --reload --port 8000

Endpoint principal:
    POST /chat
    body: {"message": "texto do usuário", "session_id": "opcional"}
    resposta: {"response": "texto do JAIME"}
"""

import os
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai

# ---------------------------------------------------------------------------
# System prompt do JAIME
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """[Insira o System Prompt Aqui]"""

# ---------------------------------------------------------------------------
# Configuração do cliente Gemini
# ---------------------------------------------------------------------------
client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY"),
)

GENERATION_CONFIG = {
    "max_output_tokens": 65536,
    "thinking_level": "medium",
}

MODEL_NAME = "models/gemini-3.7-flash"

# ---------------------------------------------------------------------------
# App FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="JAIME API")

# Libera acesso do frontend (HUD) rodando em outra origem/porta.
# Em produção, troque "*" pela origem real do HUD servido no estande.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Histórico de conversa em memória, por sessão.
# Simples o suficiente para uma demo de estande; troque por um banco
# de verdade se o projeto crescer além do evento.
_sessions: dict[str, list[dict]] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


def build_input_with_history(session_id: str, message: str) -> str:
    """
    Monta o texto de entrada incluindo o histórico da sessão.
    O SDK usado aqui recebe um único bloco de texto como `input`,
    então o histórico é concatenado de forma simples, marcando
    quem falou o quê.
    """
    history = _sessions.get(session_id, [])
    turns = []
    for turn in history:
        turns.append(f"{turn['role']}: {turn['content']}")
    turns.append(f"Visitante: {message}")
    return "\n".join(turns)


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia.")

    session_id = req.session_id or str(uuid.uuid4())
    input_text = build_input_with_history(session_id, req.message)

    try:
        interaction = client.interactions.create(
            model=MODEL_NAME,
            input=input_text,
            system_instruction=SYSTEM_PROMPT,
            generation_config=GENERATION_CONFIG,
        )
        reply_text = interaction.output_text
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar o modelo: {exc}")

    # Atualiza o histórico da sessão
    history = _sessions.setdefault(session_id, [])
    history.append({"role": "Visitante", "content": req.message})
    history.append({"role": "JAIME", "content": reply_text})

    return ChatResponse(response=reply_text, session_id=session_id)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
