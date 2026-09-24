/** @format */

import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import Topbar from "./components/Topbar";
import StatusPanel from "./components/StatusPanel";
import ChatPanel from "./components/ChatPanel";
import OrbCenter from "./components/OrbCenter";
import RightPanel from "./components/RightPanel";
import TTSTester from "./components/TTSTester";

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

// Hook de máquina de escrever com reset inteligente
function useTypewriter(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState("");
  const prevTextRef = useRef("");

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    // Se o texto novo não começa com o anterior, é uma nova mensagem. Reseta.
    if (
      text.length < prevTextRef.current.length ||
      !text.startsWith(prevTextRef.current)
    ) {
      setDisplayed("");
      prevTextRef.current = "";
    }

    const animate = () => {
      setDisplayed((prev) => {
        if (prev.length >= text.length) {
          prevTextRef.current = text; // Marca como totalmente digitado
          return prev;
        }
        // Digita 2 caracteres por vez para fluidez
        const next = text.slice(0, prev.length + 2);
        timeout = setTimeout(animate, speed);
        return next;
      });
    };

    animate();
    return () => clearTimeout(timeout);
  }, [text, speed]);

  return displayed;
}

interface Message {
  id: number;
  who: string;
  text: string;
}

function App() {
  const startRef = useRef<number>(Date.now());
  const audioQueue = useRef<Array<{ text: string; emoji: string }>>([]);
  const isPlaying = useRef(false);
  const streamFinished = useRef(false);
  const streamingMessageIdRef = useRef<number | null>(null); // Rastreia o ID exato da mensagem ativa

  const [clock, setClock] = useState<string>("00:00:00");
  const [uptime, setUptime] = useState<string>("00:00:00");
  const [tokens, setTokens] = useState<number>(0);
  const [stateLabel, setStateLabel] = useState<string>("IDLE");
  const [expTime, setExpTime] = useState<string>("00:12");
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [thinkingText, setThinkingText] = useState<string>(
    "Reunindo contexto...",
  );
  const [activeEmoji, setActiveEmoji] = useState<string>("◉");
  const [waveHeights, setWaveHeights] = useState<number[]>(() =>
    Array.from({ length: 48 }, () => 6 + Math.random() * 90),
  );

  const [streamingTargetText, setStreamingTargetText] = useState("");
  const displayedStreamingText = useTypewriter(streamingTargetText, 35);

  // Fila de reprodução de áudio
  const processQueue = useCallback(async () => {
    if (isPlaying.current || audioQueue.current.length === 0) {
      if (streamFinished.current && audioQueue.current.length === 0) {
        setActiveEmoji("◉");
        setIsSpeaking(false);
      }
      return;
    }

    isPlaying.current = true;
    setIsSpeaking(true);
    const item = audioQueue.current[0];
    setActiveEmoji(item.emoji);

    try {
      const response = await fetch(`${API_URL}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.play().catch(() => resolve());
        });
      }
    } catch (e) {
      console.error("TTS error", e);
    }

    audioQueue.current.shift();
    isPlaying.current = false;
    processQueue(); // Processa o próximo da fila
  }, []);

  // Timers de UI
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString("pt-BR", { hour12: false }));
      const elapsed = (Date.now() - startRef.current) / 1000;
      setUptime(formatDuration(elapsed));
      setExpTime(formatDuration(elapsed % 600).slice(3));
    };
    tick();
    const timer = setInterval(tick, 1000);
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
    ];
    let index = 0;
    setThinkingText(steps[0]);
    const timer = setInterval(() => {
      index = (index + 1) % steps.length;
      setThinkingText(steps[index]);
    }, 4000);
    return () => clearInterval(timer);
  }, [isSending]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    // 1. Reset total de estados para nova interação
    audioQueue.current = [];
    isPlaying.current = false;
    streamFinished.current = false;
    setStreamingTargetText("");
    streamingMessageIdRef.current = null;

    const userMessage: Message = {
      id: Date.now(),
      who: "Visitante",
      text: trimmed,
    };
    const streamingMessageId = Date.now() + 1;
    streamingMessageIdRef.current = streamingMessageId; // Salva o ID para atualizar com precisão

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: streamingMessageId, who: "JAIME", text: "" },
    ]);
    setInput("");
    setIsSending(true);
    setActiveEmoji("◉");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 130000);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          session_id: sessionId ?? undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok || !response.body)
        throw new Error("Falha na conexão com o servidor.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let accumulatedText = "";
      let processedSentencesCount = 0;
      let isDone = false;

      while (!isDone) {
        const { done, value } = await reader.read();
        if (done) {
          isDone = true;
          break;
        }

        accumulatedText += decoder.decode(value, { stream: true });

        try {
          const parsed = JSON.parse(accumulatedText);

          if (parsed && parsed.sentence && Array.isArray(parsed.sentence)) {
            const newSentences = parsed.sentence.slice(processedSentencesCount);

            for (const item of newSentences) {
              if (item.text) {
                // 1. Alimenta a máquina de escrever
                setStreamingTargetText(
                  (prev) => prev + (prev ? " " : "") + item.text,
                );

                const emoji = item.emoji || "🤖";

                // 2. Atualiza o Orb
                setActiveEmoji(emoji);

                // 3. Fila de TTS
                audioQueue.current.push({ text: item.text, emoji });
                if (!isPlaying.current) {
                  processQueue();
                }
              }
            }
            processedSentencesCount = parsed.sentence.length;
          }
        } catch (e) {
          // SyntaxError é esperado e ignorado enquanto o JSON está incompleto
          if (!(e instanceof SyntaxError)) {
            console.error("Erro inesperado no parse:", e);
          }
        }
      }

      streamFinished.current = true;

      // Extrai metadados no final
      const metaIndex = accumulatedText.indexOf('\n\n{"_meta":');
      if (metaIndex !== -1) {
        try {
          const meta = JSON.parse(accumulatedText.substring(metaIndex + 2));
          if (meta._meta?.session_id) setSessionId(meta._meta.session_id);
          if (typeof meta._meta?.total_tokens === "number")
            setTokens(meta._meta.total_tokens);
        } catch {
          /* ignora */
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage =
        error instanceof Error
          ? error.name === "AbortError"
            ? "A conexão demorou muito e foi cancelada."
            : error.message
          : "Erro desconhecido";

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, who: "JAIME", text: `Erro: ${errorMessage}` },
      ]);
      setActiveEmoji("◉");
      setIsSpeaking(false);
    } finally {
      setIsSending(false);
    }
  };

  // Efeito para atualizar o chat com o texto sendo "digitado"
  useEffect(() => {
    if (!streamingMessageIdRef.current) return;

    const msgId = streamingMessageIdRef.current;
    setMessages((prev) => {
      const msgIndex = prev.findIndex((m) => m.id === msgId);
      if (msgIndex === -1) return prev; // Mensagem não encontrada

      if (prev[msgIndex].text === displayedStreamingText) return prev; // Já está atualizado

      const newMessages = [...prev];
      newMessages[msgIndex] = {
        ...prev[msgIndex],
        text: displayedStreamingText,
      };
      return newMessages;
    });
  }, [displayedStreamingText]);

  // Efeito de limpeza final quando tudo termina
  useEffect(() => {
    if (
      streamFinished.current &&
      !isPlaying.current &&
      audioQueue.current.length === 0
    ) {
      setActiveEmoji("◉");
      setIsSpeaking(false);
      streamingMessageIdRef.current = null; // Limpa o ID para a próxima vez
    }
  }, [isPlaying, streamFinished]);

  return (
    <div className="shell">
      <Topbar clock={clock} />
      <main className="main-grid">
        <div className="col-left">
          <StatusPanel uptime={uptime} tokens={tokens} />
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
          isSpeaking={isSpeaking}
        />
        {/* <RightPanel
          expTime={expTime}
          waveHeights={waveHeights}
          isSpeaking={isSpeaking}
        /> */}
        <TTSTester />
      </main>
      <footer className="legend">
        Laboratório do Futuro · Ilum — Escola de Ciência · IPA 2026
      </footer>
    </div>
  );
}

export default App;
