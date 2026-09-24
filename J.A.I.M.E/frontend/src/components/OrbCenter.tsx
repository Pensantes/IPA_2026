/** @format */

interface OrbCenterProps {
  stateLabel: string;
  activeEmoji?: string;
  isSpeaking?: boolean;
}

function OrbCenter({
  stateLabel,
  activeEmoji = "◉",
  isSpeaking = false,
}: OrbCenterProps) {
  return (
    <div className="col-center">
      <div className={`orb-wrap ${isSpeaking ? "is-speaking" : ""}`}>
        {/* Glow de fundo que pulsa */}
        <div className="orb-glow" />

        <svg className="orb-svg" viewBox="0 0 200 200" fill="none">
          {/* Anéis 3D Giratórios */}
          <g className="orb-rings">
            <circle className="ring ring-1" cx="100" cy="100" r="85" />
            <circle className="ring ring-2" cx="100" cy="100" r="85" />
            <circle className="ring ring-3" cx="100" cy="100" r="85" />
            <circle className="ring ring-4" cx="100" cy="100" r="85" />
          </g>

          {/* Núcleo esférico com gradiente */}
          <defs>
            <radialGradient id="coreGradient" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#8c00ff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#7e0bc1" stopOpacity="0.1" />
            </radialGradient>
            <radialGradient id="coreGradientSpeaking" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="40%" stopColor="#ff00aa" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#aa00ff" stopOpacity="0.2" />
            </radialGradient>
          </defs>

          <circle
            className="orb-core"
            cx="100"
            cy="100"
            r="50"
            fill={
              isSpeaking ? "url(#coreGradientSpeaking)" : "url(#coreGradient)"
            }
          />

          {/* Anel interno de detalhe */}
          {/* <circle className="orb-inner-ring" cx="100" cy="100" r="35" /> */}
        </svg>

        {/* Emoji flutuante no centro */}
        <div className="orb-emoji-container">
          <span className={`orb-emoji ${isSpeaking ? "speaking" : "idle"}`}>
            {activeEmoji}
          </span>
        </div>
      </div>

      <div className="orb-status">
        <span className={`status-dot ${isSpeaking ? "active" : ""}`} />
        <span className="status-text">{stateLabel}</span>
      </div>
    </div>
  );
}

export default OrbCenter;
