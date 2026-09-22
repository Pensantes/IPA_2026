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
  loadPct: string;
  loadBar: number;
}

function StatusPanel({ uptime, tokens, loadPct, loadBar }: StatusPanelProps) {
  const [health, setHealth] = useState<HealthData | null>(null);

  // Busca dados do /health a cada 5 segundos
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
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Determina a classe do flag baseado no api_status
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
        <span>{health?.latency_ms ? `${health.latency_ms} ms` : "—"}</span>
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

      <div className="load-meta">
        <span>Carga de proc.</span>
        <span>{loadPct}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${loadBar}%` }} />
      </div>

      {health?.error && (
        <div
          style={{
            fontSize: "10px",
            color: "#ff5d7a",
            marginTop: "8px",
            wordBreak: "break-word",
          }}
        >
          {health.error}
        </div>
      )}
    </aside>
  );
}

export default StatusPanel;
