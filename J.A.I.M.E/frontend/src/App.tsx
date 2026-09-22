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

function escapeJsonString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, '\\\"')
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ");
}

function extractStreamSnapshot(rawText: string): {
  text: string;
  emoji: string;
} | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.sentence)
    ) {
      const items = parsed.sentence.filter(
        (item: { text?: string; emoji?: string }) =>
          item && typeof item === "object",
      );

      const text = items
        .map((item) => item.text ?? "")
        .filter(Boolean)
        .join(" ")
        .trim();

      const emoji =
        [...items].reverse().find((item) => item.emoji)?.emoji ?? "🤖";
      return { text, emoji };
    }
  } catch {
    // fallback best-effort parsing while stream is still incomplete
  }

  const raw = trimmed;
  const textMatches = Array.from(
    raw.matchAll(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/g),
  );
  const emojiMatches = Array.from(
    raw.matchAll(/"emoji"\s*:\s*"((?:\\.|[^"\\])*)"/g),
  );

  const text = textMatches
    .map((match) =>
      match[1].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
    )
    .join(" ")
    .trim();

  const emoji = emojiMatches.length
    ? emojiMatches[emojiMatches.length - 1][1].replace(/\\n/g, " ")
    : "🤖";

  if (!text && !emojiMatches.length) {
    return null;
  }

  return { text: text || "JAIME está respondendo...", emoji: emoji || "🤖" };
}

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
  const [thinkingText, setThinkingText] = useState<string>(
    "Reunindo contexto...",
  );
  const [activeEmoji, setActiveEmoji] = useState<string>("◉");
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

  useEffect(() => {
    if (!isSending) {
      setThinkingText("Reunindo contexto...");
      return;
    }

    const steps = [
      "Reunindo contexto...",
      "Analisando memórias...",
      "Pensando na resposta...",
      "Estruturando resposta...",
      "Preparando a finalização...",
    ];

    let index = 0;
    setThinkingText(steps[0]);

    const timer = setInterval(() => {
      index = (index + 1) % steps.length;
      setThinkingText(steps[index]);
    }, 1400);

    return () => clearInterval(timer);
  }, [isSending]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const sendAttempt = async (retrying = false): Promise<void> => {
      const userMessage: Message = {
        id: Date.now(),
        who: "Visitante",
        text: trimmed,
      };

      setMessages((previous) => [...previous, userMessage]);
      setInput("");
      setActiveEmoji("🤖");
      setIsSending(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 130000);

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
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok || !response.body) {
          throw new Error("Falha na conexão com o servidor.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";
        let isDone = false;
        let lastStreamingText = "";
        let lastEmoji = "🤖";
        const streamingMessageId = Date.now() + 1;

        setMessages((previous) => [
          ...previous,
          {
            id: streamingMessageId,
            who: "JAIME",
            text: "",
          },
        ]);

        while (!isDone) {
          const { done, value } = await reader.read();
          if (done) {
            isDone = true;
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          const metaIndex = accumulatedText.indexOf('\n\n{"_meta":');
          const payload =
            metaIndex === -1
              ? accumulatedText
              : accumulatedText.slice(0, metaIndex);

          const snapshot = extractStreamSnapshot(payload);

          if (snapshot) {
            if (snapshot.emoji) {
              lastEmoji = snapshot.emoji;
              setActiveEmoji(snapshot.emoji);
            }

            if (snapshot.text) {
              lastStreamingText = snapshot.text;
              setMessages((previous) =>
                previous.map((msg) =>
                  msg.id === streamingMessageId
                    ? { ...msg, text: snapshot.text }
                    : msg,
                ),
              );
            }
          }

          if (metaIndex !== -1) {
            isDone = true;
            const metaString = accumulatedText.substring(metaIndex + 2);
            try {
              const meta = JSON.parse(metaString);
              if (meta._error) {
                throw new Error(meta._error);
              }
              if (meta._meta?.session_id) setSessionId(meta._meta.session_id);
              if (typeof meta._meta?.total_tokens === "number")
                setTokens(meta._meta.total_tokens);
            } catch {
              // ignora metadados incompletos e segue com o texto já exibido
            }
          }
        }

        const finalPayload = accumulatedText.trim();
        if (!finalPayload || !lastStreamingText) {
          if (retrying) {
            throw new Error(
              "O modelo respondeu sem texto válido. Tente novamente.",
            );
          }

          setMessages((previous) => [
            ...previous,
            {
              id: Date.now() + 2,
              who: "JAIME",
              text: "Resposta incompleta. Tentando novamente...",
            },
          ]);

          await sendAttempt(true);
          return;
        }

        setActiveEmoji(lastEmoji || "🤖");
      } catch (error) {
        clearTimeout(timeoutId);
        let errorMessage = "Erro desconhecido";

        if (error instanceof Error) {
          if (error.name === "AbortError") {
            errorMessage =
              "A conexão demorou muito e foi cancelada. Tente novamente.";
          } else {
            errorMessage = error.message;
          }
        }

        if (!retrying) {
          setMessages((previous) => [
            ...previous,
            {
              id: Date.now() + 2,
              who: "JAIME",
              text: "Resposta incompleta. Tentando novamente...",
            },
          ]);
          await sendAttempt(true);
          return;
        }

        setMessages((previous) => [
          ...previous,
          {
            id: Date.now() + 3,
            who: "JAIME",
            text: `Erro de conexão: ${errorMessage}`,
          },
        ]);
      } finally {
        setIsSending(false);
        setActiveEmoji("◉");
      }
    };

    await sendAttempt(false);
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
            thinkingText={thinkingText}
          />
        </div>

        <OrbCenter
          stateLabel={stateLabel}
          activeEmoji={activeEmoji}
          isSpeaking={isSending}
        />

        <RightPanel expTime={expTime} waveHeights={waveHeights} />
      </main>

      <footer className="legend">
        Laboratório do Futuro · Ilum — Escola de Ciência · IPA 2026
      </footer>
    </div>
  );
}

export default App;
