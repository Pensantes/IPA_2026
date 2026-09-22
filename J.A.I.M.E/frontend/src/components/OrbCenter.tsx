/** @format */

function OrbCenter({ stateLabel, activeEmoji = "◉", isSpeaking = false }) {
  return (
    <div className="col-center">
      <div className="orb-wrap">
        <div className="orb-glow" />
        <svg
          className="orb-svg"
          viewBox="0 0 200 200"
          fill="none"
          strokeWidth="0.6"
        >
          <circle className="orb-core" cx="100" cy="100" r="70" />
          <circle cx="100" cy="100" r="70" opacity="0.6" />
          <circle
            cx="100"
            cy="100"
            r="70"
            opacity="0.35"
            transform="rotate(120 100 100) scale(1,0.42)"
            transformOrigin="100 100"
          />
          <circle
            cx="100"
            cy="100"
            r="70"
            opacity="0.35"
            transform="rotate(0 100 100) scale(1,0.42)"
            transformOrigin="100 100"
          />
          <circle cx="100" cy="100" r="46" opacity="0.5" />
          <circle cx="100" cy="100" r="20" opacity="0.8" />
          <path
            id="jitter"
            d="M 30 100 Q 55 80, 75 100 T 115 100 T 155 100 T 170 100"
            opacity="0.7"
          />
        </svg>

        <div
          className={`orb-emoji ${isSpeaking ? "speaking" : "idle"}`}
          aria-live="polite"
        >
          {activeEmoji}
        </div>
      </div>

      <div className="orb-status">
        <span className="bit" />
        <span>{stateLabel}</span>
      </div>
    </div>
  );
}

export default OrbCenter;
