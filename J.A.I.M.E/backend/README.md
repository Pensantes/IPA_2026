# JAIME API

API mínima em FastAPI que expõe o JAIME via um único endpoint de chat.

## Rodando localmente

```bash
pip install -r requirements.txt
cp .env.example .env   # e coloque sua chave real do Gemini
export $(cat .env | xargs)   # ou use python-dotenv/uvicorn --env-file
uvicorn main:app --reload --port 8000
```

## Endpoint

`POST /chat`

Body:
```json
{
  "message": "isso é perigoso?",
  "session_id": "opcional — se omitido, uma nova sessão é criada"
}
```

Resposta:
```json
{
  "response": "Só se você tentar beber.",
  "session_id": "id-da-sessao"
}
```

Guarde o `session_id` retornado e reenvie nas próximas chamadas da mesma
conversa, para o JAIME manter contexto do que já foi dito.

## Próximos passos sugeridos

- Trocar o histórico em memória (`_sessions`) por algo persistente, se a
  sessão precisar sobreviver a um restart do servidor durante o evento.
- Adicionar um segundo endpoint (ou tool calling dentro do próprio modelo)
  para os comandos que devem acionar a RASPILUM de fato.
- Plugar STT antes do `/chat` (recebe áudio, transcreve, manda o texto pra
  cá) e TTS depois (pega `response` e devolve áudio).
