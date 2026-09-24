/** @format */

import { useState, useEffect } from "react";

export default function TTSTester() {
  const [text, setText] = useState<string>(
    "Olá, eu sou o JAIME. Este é um teste de síntese de voz para ajustar os parâmetros do modelo.",
  );

  const [lengthScale, setLengthScale] = useState<number>(1.2);
  const [noiseScale, setNoiseScale] = useState<number>(0.13);
  const [noiseW, setNoiseW] = useState<number>(0.21);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [genTime, setGenTime] = useState<number | null>(null);

  // Limpa a URL do objeto anterior para evitar vazamento de memória
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("O texto não pode estar vazio.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    setGenTime(null);

    const startTime = performance.now();

    try {
      const response = await fetch("http://localhost:8000/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          length_scale: lengthScale,
          noise_scale: noiseScale,
          noise_w: noiseW,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Erro HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setAudioUrl(url);
      setGenTime((performance.now() - startTime) / 1000);
    } catch (err: any) {
      console.error("TTS Test Error:", err);
      setError(err.message || "Falha ao gerar áudio.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div className="panel-head">
        <div className="panel-title">🔊 JAIME TTS Tester</div>
        <div className="panel-flag ok">Local</div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label
          className="who"
          style={{ marginBottom: "6px", display: "block" }}
        >
          Texto para síntese:
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            padding: "12px",
            borderRadius: "var(--radius)",
            fontFamily: "var(--mono)",
            fontSize: "14px",
            resize: "vertical",
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        {/* Length Scale */}
        <div>
          <div className="stat-row" style={{ border: "none", padding: 0 }}>
            <span>Length Scale (Velocidade)</span>
            <span style={{ color: "var(--accent)" }}>
              {lengthScale.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={lengthScale}
            onChange={(e) => setLengthScale(parseFloat(e.target.value))}
            style={{
              width: "100%",
              marginTop: "8px",
              accentColor: "var(--accent)",
            }}
          />
        </div>

        {/* Noise Scale */}
        <div>
          <div className="stat-row" style={{ border: "none", padding: 0 }}>
            <span>Noise Scale (Entonação)</span>
            <span style={{ color: "var(--accent)" }}>
              {noiseScale.toFixed(3)}
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.01"
            value={noiseScale}
            onChange={(e) => setNoiseScale(parseFloat(e.target.value))}
            style={{
              width: "100%",
              marginTop: "8px",
              accentColor: "var(--accent)",
            }}
          />
        </div>

        {/* Noise W */}
        <div>
          <div className="stat-row" style={{ border: "none", padding: 0 }}>
            <span>Noise W (Duração Fonemas)</span>
            <span style={{ color: "var(--accent)" }}>{noiseW.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.01"
            value={noiseW}
            onChange={(e) => setNoiseW(parseFloat(e.target.value))}
            style={{
              width: "100%",
              marginTop: "8px",
              accentColor: "var(--accent)",
            }}
          />
        </div>
      </div>

      <button
        className="btn"
        onClick={handleGenerate}
        disabled={isLoading}
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "12px",
          letterSpacing: "0.15em",
          background: isLoading ? "var(--text-faint)" : "var(--accent-2)",
          borderColor: isLoading ? "var(--text-faint)" : "var(--accent)",
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
        }}
      >
        {isLoading ? "⏳ GERANDO ÁUDIO..." : "🎵 GERAR ÁUDIO"}
      </button>

      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "10px",
            background: "rgba(255, 93, 122, 0.1)",
            border: "1px solid var(--err)",
            borderRadius: "var(--radius)",
            color: "var(--err)",
            fontSize: "12px",
          }}
        >
          ❌ {error}
        </div>
      )}

      {audioUrl && (
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <div
            className="stat-row"
            style={{ justifyContent: "center", marginBottom: "8px" }}
          >
            <span style={{ color: "var(--ok)" }}>
              ✅ Sucesso! Gerado em {genTime?.toFixed(2)}s
            </span>
          </div>
          <audio
            controls
            src={audioUrl}
            autoPlay
            style={{
              width: "100%",
              filter:
                "invert(1) hue-rotate(180deg)" /* Deixa o player nativo escuro */,
              borderRadius: "var(--radius)",
            }}
          />
        </div>
      )}
    </div>
  );
}
