/** @format */

import { useState, useEffect } from "react";

interface HealthData {
  app_status: string;
  api_status: string;
  model_configured: string;
  latency_ms: number | null;
  available_models_count: number;
  error: string | null;
}

interface StatusPanelProps {
  uptime: string;
  tokens: number;
}

function StatusPanel({ uptime, tokens }: StatusPanelProps) {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch("http://localhost:8000/health");
        const data: HealthData = await res.json();
        setHealth(data);
      } catch (err: unknown) {
        console.error("Erro ao buscar health:", err);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Determina a classe do flag principal baseado no api_status
  const getStatusClass = (): string => {
    if (!health) return "";
    if (health.api_status === "ok") return "ok";
    if (health.api_status === "warning") return "warn";
    return "err";
  };

  const getStatusText = (): string => {
    if (!health) return "Verificando...";
    if (health.api_status === "ok") return "Online";
    if (health.api_status === "warning") return "Degradado";
    return "Offline";
  };

  // NOVO: Badge de qualidade baseado na latência
  const getLatencyBadge = (ms: number | null) => {
    if (ms === null) return { class: "warn", text: "N/A" };
    if (ms < 500) return { class: "ok", text: "Excelente" };
    if (ms < 1500) return { class: "warn", text: "Moderada" };
    return { class: "err", text: "Alta" };
  };

  const latencyBadge = getLatencyBadge(health?.latency_ms ?? null);

  // NOVO: Barra de uso de contexto (visualização real dos tokens)
  // Usamos 4000 como referência visual de um "context window" padrão seguro
  const MAX_CONTEXT_VISUAL = 4000;
  const tokenPct = Math.min((tokens / MAX_CONTEXT_VISUAL) * 100, 100);

  // A cor da barra muda conforme o uso aumenta
  const getBarColor = () => {
    if (tokenPct > 80) return "var(--err)";
    if (tokenPct > 50) return "var(--warn)";
    return "var(--ok)";
  };

  return (
    <aside className="panel">
      <div className="panel-head">
        <div className="panel-title">System Status</div>
        <div className={`panel-flag ${getStatusClass()}`}>
          {getStatusText()}
        </div>
      </div>

      <div className="stat-row">
        <span>Uptime</span>
        <span>{uptime}</span>
      </div>

      <div className="stat-row">
        <span>Latência API</span>
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {health?.latency_ms ? `${health.latency_ms} ms` : "—"}
          {/* Badge de Latência */}
          <span
            className="panel-flag"
            style={{
              fontSize: "8px",
              padding: "1px 4px",
              color: `var(--${latencyBadge.class})`,
              borderColor: `var(--${latencyBadge.class})`,
              opacity: 0.8,
            }}
          >
            {latencyBadge.text}
          </span>
        </span>
      </div>

      <div className="stat-row">
        <span>Modelo</span>
        <span>{health?.model_configured || "—"}</span>
      </div>

      <div className="stat-row">
        <span>Tokens (sessão)</span>
        <span>{tokens}</span>
      </div>

      <div className="stat-row">
        <span>Modelos disponíveis</span>
        <span>{health?.available_models_count || 0}</span>
      </div>

      {/* SUBSTITUÍDO: Barra de Uso de Contexto (Real) no lugar da Carga Fictícia */}
      <div className="load-meta">
        <span>Uso de contexto (sessão)</span>
        <span>
          {tokens} / ~{MAX_CONTEXT_VISUAL}
        </span>
      </div>
      <div className="bar">
        <i
          style={{
            width: `${tokenPct}%`,
            background: getBarColor(),
            transition: "width 0.5s ease, background 0.5s ease",
          }}
        />
      </div>

      {health?.error && (
        <div
          style={{
            fontSize: "10px",
            color: "var(--err)",
            marginTop: "8px",
            wordBreak: "break-word",
            lineHeight: "1.4",
          }}
        >
          ⚠️ {health.error}
        </div>
      )}
    </aside>
  );
}

export default StatusPanel;
