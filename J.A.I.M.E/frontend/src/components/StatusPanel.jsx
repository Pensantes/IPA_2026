function StatusPanel({ uptime, tokens, loadPct, loadBar }) {
  return (
    <aside className="panel">
      <div className="panel-head">
        <div className="panel-title">System Status</div>
        <div className="panel-flag ok">Online</div>
      </div>

      <div className="stat-row">
        <span>Uptime</span>
        <span>{uptime}</span>
      </div>
      <div className="stat-row">
        <span>Latência STT→TTS</span>
        <span>380 ms</span>
      </div>
      <div className="stat-row">
        <span>Modelo</span>
        <span>JAIME-CORE v1</span>
      </div>
      <div className="stat-row">
        <span>Tokens (sessão)</span>
        <span>{tokens}</span>
      </div>

      <div className="load-meta">
        <span>Carga de proc.</span>
        <span>{loadPct}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${loadBar}%` }} />
      </div>
    </aside>
  )
}

export default StatusPanel
