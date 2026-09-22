"""
API do JAIME — com tool calling nativo e response_schema estruturado.
"""

import os
import uuid
import json
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai

load_dotenv(Path(__file__).with_name('.env'))

# ---------------------------------------------------------------------------
# 1. System Prompt
# ---------------------------------------------------------------------------
PROMPT_PATH = Path(__file__).parent.parent / "SYSTEM_PROMPT.md"
try:
    SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8")
except FileNotFoundError:
    SYSTEM_PROMPT = "Você é o JAIME. Responda em JSON estruturado."

# ---------------------------------------------------------------------------
# 2. Cliente Gemini
# ---------------------------------------------------------------------------
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

MODEL_NAME = os.environ.get("GEMINI_MODEL", "models/gemini-3.5-flash-lite")

# Schema de resposta estruturada
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
                        "enum": [
                            "neutro", "seco", "irônico", "curioso",
                            "brincalhão", "sério", "pensativo", "satisfeito",
                        ],
                    },
                },
                "required": ["emoji", "text", "tone"],
            },
        }
    },
    "required": ["sentence"],
}

# Tool de memória
TOOLS = [
    {
        "function_declarations": [
            {
                "name": "save_memory",
                "description": (
                    "Salva um fato importante sobre o visitante ou o estado do "
                    "laboratório para ser lembrado em interações futuras. Use para "
                    "nome, preferências, descobertas do experimento, piadas internas."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "fact": {
                            "type": "string",
                            "description": "O fato a ser lembrado, escrito de forma concisa.",
                        }
                    },
                    "required": ["fact"],
                },
            }
        ]
    }
]

GENERATION_CONFIG = {
    "max_output_tokens": 1024,
    "temperature": 0.7,
    "response_mime_type": "application/json",
    "response_schema": RESPONSE_SCHEMA,
}

# ---------------------------------------------------------------------------
# 3. SQLite de memória
# ---------------------------------------------------------------------------
DB_PATH = Path(__file__).parent / "jaime_memory.db"


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                fact TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_session ON memories(session_id)"
        )


def add_memory(session_id: str, fact: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO memories (session_id, fact) VALUES (?, ?)",
            (session_id, fact),
        )


def get_memories(session_id: str) -> list[str]:
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "SELECT fact FROM memories WHERE session_id = ? "
            "ORDER BY created_at DESC LIMIT 5",
            (session_id,),
        )
        return [row[0] for row in cursor.fetchall()][::-1]


init_db()

# ---------------------------------------------------------------------------
# 4. App FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="JAIME API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_sessions: dict[str, list[dict]] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    response: dict
    session_id: str
    memories_saved: int = 0


def build_contents(session_id: str, message: str) -> list[dict]:
    """Monta o histórico no formato de contents do Gemini."""
    contents = []

    memories = get_memories(session_id)
    if memories:
        memo_text = "Memórias desta sessão:\n- " + "\n- ".join(memories)
        contents.append({"role": "user", "parts": [{"text": memo_text}]})
        contents.append(
            {
                "role": "model",
                "parts": [{"text": "Entendido. Vou considerar essas memórias."}],
            }
        )

    history = _sessions.get(session_id, [])
    for turn in history[-6:]:
        role = "model" if turn["role"] == "JAIME" else "user"
        contents.append({"role": role, "parts": [{"text": turn["content"]}]})

    contents.append({"role": "user", "parts": [{"text": message}]})
    return contents


def handle_tool_calls(session_id: str, response) -> int:
    """Processa chamadas de tool e retorna quantas memórias foram salvas."""
    saved = 0
    for candidate in response.candidates:
        for part in candidate.content.parts:
            if part.function_call and part.function_call.name == "save_memory":
                fact = part.function_call.args.get("fact", "").strip()
                if fact:
                    add_memory(session_id, fact)
                    saved += 1
    return saved


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia.")

    session_id = req.session_id or str(uuid.uuid4())
    contents = build_contents(session_id, req.message)

    try:
        memories_saved = 0
        response = None

        while True:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=contents,
                config={
                    "system_instruction": SYSTEM_PROMPT,
                    "tools": TOOLS,
                    **GENERATION_CONFIG,
                },
            )

            has_tool_call = any(
                part.function_call
                for candidate in response.candidates
                for part in candidate.content.parts
            )

            if not has_tool_call:
                break

            memories_saved += handle_tool_calls(session_id, response)

            contents.append(
                {
                    "role": "model",
                    "parts": [
                        {"function_call": p.function_call}
                        if p.function_call
                        else {"text": p.text}
                        for p in response.candidates[0].content.parts
                    ],
                }
            )

            tool_responses = []
            for candidate in response.candidates:
                for part in candidate.content.parts:
                    if part.function_call and part.function_call.name == "save_memory":
                        tool_responses.append(
                            {
                                "function_response": {
                                    "name": "save_memory",
                                    "response": {"status": "ok", "saved": True},
                                }
                            }
                        )
            contents.append({"role": "user", "parts": tool_responses})

        reply_json = json.loads(response.text)

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502, detail=f"Resposta inválida do modelo: {exc}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Erro ao consultar o modelo: {exc}"
        )

    history = _sessions.setdefault(session_id, [])
    history.append({"role": "Visitante", "content": req.message})
    plain_reply = " ".join(s.get("text", "") for s in reply_json.get("sentence", []))
    history.append({"role": "JAIME", "content": plain_reply})
    if len(history) > 20:
        _sessions[session_id] = history[-20:]

    print(reply_json)

    return ChatResponse(
        response=reply_json,
        session_id=session_id,
        memories_saved=memories_saved,
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "memory_db": str(DB_PATH.exists())}