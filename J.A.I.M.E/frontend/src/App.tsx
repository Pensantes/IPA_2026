/** @format */

import { useEffect, useRef, useState } from "react";
import "./App.css";
import Topbar from "./components/Topbar";
import StatusPanel from "./components/StatusPanel";
import ChatPanel from "./components/ChatPanel";
import OrbCenter from "./components/OrbCenter";
import RightPanel from "./components/RightPanel";

const API_URL = "http://localhost:8000";

function formatDuration(totalSeconds: number): string {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
    2,
    "0",
  );
  const seconds = String(Math.floor(totalSeconds % 60)).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

interface Message {
  id: number;
  who: string;
  text: string;
}

const initialMessages: Message[] = [];

function App() {
  const startRef = useRef<number>(Date.now());

  const [clock, setClock] = useState<string>("00:00:00");
  const [uptime, setUptime] = useState<string>("00:00:00");
  const [tokens, setTokens] = useState<number>(0); // Começa em 0, será atualizado pela API
  const [loadPct, setLoadPct] = useState<string>("22%");
  const [loadBar, setLoadBar] = useState<number>(22);
  const [stateLabel, setStateLabel] = useState<string>("IDLE");
  const [expTime, setExpTime] = useState<string>("00:12");
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [waveHeights, setWaveHeights] = useState<number[]>(() =>
    Array.from({ length: 48 }, () => 6 + Math.random() * 90),
  );

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("pt-BR", {
          hour12: false,
        }),
      );

      const elapsed = (Date.now() - startRef.current) / 1000;
      setUptime(formatDuration(elapsed));
      setExpTime(formatDuration(elapsed % 600).slice(3));

      // REMOVIDO: setTokens(Math.floor(elapsed * 14));
      // Os tokens agora vêm exclusivamente da resposta da API.
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const value = 15 + Math.random() * 30;
      setLoadBar(Number(value.toFixed(0)));
      setLoadPct(`${value.toFixed(0)}%`);
    }, 1400);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const states = ["IDLE", "OUVINDO", "PROCESSANDO", "RESPONDENDO"];
    let index = 0;

    const timer = setInterval(() => {
      index = (index + 1) % states.length;
      setStateLabel(states[index]);
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setWaveHeights(Array.from({ length: 48 }, () => 6 + Math.random() * 90));
    }, 220);

    return () => clearInterval(timer);
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = {
      id: Date.now(),
      who: "Visitante",
      text: trimmed,
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setIsSending(true);

    // Configura um timeout de 20 segundos para a requisição
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          session_id: sessionId ?? undefined,
        }),
        signal: controller.signal, // <-- Conecta o abort ao fetch
      });

      clearTimeout(timeoutId); // Cancela o timer se a resposta chegou a tempo

      const data = (await response.json()) as {
        response?: { sentence?: { text: string }[] };
        session_id: string;
        total_tokens: number;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data?.detail || "Erro ao enviar mensagem.");
      }

      const replyText = (data.response?.sentence ?? [])
        .map((item) => item.text)
        .join(" ")
        .trim();

      setSessionId(data.session_id);
      setTokens(data.total_tokens ?? 0);

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          who: "JAIME",
          text: replyText || "Não consegui responder agora.",
        },
      ]);
    } catch (error) {
      clearTimeout(timeoutId); // Garante que o timer seja limpo mesmo em caso de erro

      let errorMessage = "Erro desconhecido";
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage =
            "A conexão com o JAIME demorou muito e foi cancelada. Tente novamente.";
        } else {
          errorMessage = error.message;
        }
      }

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 2,
          who: "JAIME",
          text: `Erro de conexão: ${errorMessage}`,
        },
      ]);
    } finally {
      setIsSending(false); // <-- Isso agora SEMPRE vai executar, travando ou não
    }
  };

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
  );
}

export default App;
