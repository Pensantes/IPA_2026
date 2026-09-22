import { useEffect, useRef, useState } from 'react'
import './App.css'
import Topbar from './components/Topbar'
import StatusPanel from './components/StatusPanel'
import ChatPanel from './components/ChatPanel'
import OrbCenter from './components/OrbCenter'
import RightPanel from './components/RightPanel'

const API_URL = 'http://localhost:8000'

function formatDuration(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(Math.floor(totalSeconds % 60)).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const initialMessages = [
]

function App() {
  const startRef = useRef(Date.now())

  const [clock, setClock] = useState('00:00:00')
  const [uptime, setUptime] = useState('00:00:00')
  const [tokens, setTokens] = useState(0)
  const [loadPct, setLoadPct] = useState('22%')
  const [loadBar, setLoadBar] = useState(22)
  const [stateLabel, setStateLabel] = useState('IDLE')
  const [expTime, setExpTime] = useState('00:12')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(initialMessages)
  const [sessionId, setSessionId] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [waveHeights, setWaveHeights] = useState(() =>
    Array.from({ length: 48 }, () => 6 + Math.random() * 90),
  )

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(
        now.toLocaleTimeString('pt-BR', {
          hour12: false,
        }),
      )

      const elapsed = (Date.now() - startRef.current) / 1000
      setUptime(formatDuration(elapsed))
      setExpTime(formatDuration(elapsed % 600).slice(3))
      setTokens(Math.floor(elapsed * 14))
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      const value = 15 + Math.random() * 30
      setLoadBar(Number(value.toFixed(0)))
      setLoadPct(`${value.toFixed(0)}%`)
    }, 1400)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const states = ['IDLE', 'OUVINDO', 'PROCESSANDO', 'RESPONDENDO']
    let index = 0

    const timer = setInterval(() => {
      index = (index + 1) % states.length
      setStateLabel(states[index])
    }, 3200)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setWaveHeights(Array.from({ length: 48 }, () => 6 + Math.random() * 90))
    }, 220)

    return () => clearInterval(timer)
  }, [])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    const userMessage = {
      id: Date.now(),
      who: 'Visitante',
      text: trimmed,
    }

    setMessages((previous) => [...previous, userMessage])
    setInput('')
    setIsSending(true)

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          session_id: sessionId ?? undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.detail || 'Erro ao enviar mensagem.')
      }

      const replyText = (data.response?.sentence ?? [])
        .map((item) => item.text)
        .join(' ')
        .trim()

      setSessionId(data.session_id)

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          who: 'JAIME',
          text: replyText || 'Não consegui responder agora.',
        },
      ])
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 2,
          who: 'JAIME',
          text: `Erro de conexão: ${error.message}`,
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="shell">
      <Topbar clock={clock} />

      <main className="main-grid">
        <div className="col-left">
          <StatusPanel
            uptime={uptime}
            tokens={tokens}
            loadPct={loadPct}
            loadBar={loadBar}
          />
          <ChatPanel
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            disabled={isSending}
          />
        </div>

        <OrbCenter stateLabel={stateLabel} />

        <RightPanel expTime={expTime} waveHeights={waveHeights} />
      </main>

      <footer className="legend">
        Laboratório do Futuro · Ilum — Escola de Ciência · IPA 2026
      </footer>
    </div>
  )
}

export default App
