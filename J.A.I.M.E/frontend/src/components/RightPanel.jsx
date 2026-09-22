function RightPanel({ expTime, waveHeights }) {
  return (
    <aside className="col-right">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">RASPILUM</div>
          <div className="panel-flag warn">Executando</div>
        </div>

        <div className="exp-name">Solução Semáforo</div>
        <div className="exp-stage">Etapa 2 de 4 — Agitação</div>
        <div className="exp-grid">
          <div className="exp-cell">
            <div className="k">Temperatura</div>
            <div className="v">24.6 °C</div>
          </div>
          <div className="exp-cell">
            <div className="k">pH</div>
            <div className="v">7.1</div>
          </div>
          <div className="exp-cell">
            <div className="k">Tempo decorrido</div>
            <div className="v">{expTime}</div>
          </div>
          <div className="exp-cell">
            <div className="k">Repetições hoje</div>
            <div className="v">6</div>
          </div>
        </div>

        <div className="btn-row">
          <button type="button" className="btn">Pausar</button>
          <button type="button" className="btn stop">Parar</button>
        </div>
      </div>

      <div className="panel audio-panel">
        <div className="panel-head">
          <div className="panel-title">Áudio</div>
          <div className="panel-flag ok">Mic ativo</div>
        </div>

        <div className="wave" id="wave">
          {waveHeights.map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>

        <div className="mic-row">
          <button type="button" className="mic-btn">●</button>
          <div className="mic-label">
            <b>Captando voz</b>
            Fale naturalmente — o JAIME está ouvindo
          </div>
        </div>

        <div className="sens">
          <div className="k">
            <span>Sensibilidade</span>
            <span>5.0</span>
          </div>
          <input type="range" min="0" max="10" step="0.5" defaultValue="5" />
        </div>
      </div>
    </aside>
  )
}

export default RightPanel
