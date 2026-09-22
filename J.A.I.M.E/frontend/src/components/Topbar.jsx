function Topbar({ clock }) {
  return (
    <header className="topbar">
      <div>
        <div className="wordmark">
          J<span className="dot">.</span>A<span className="dot">.</span>I<span className="dot">.</span>M<span className="dot">.</span>E
        </div>
        <div className="tagline">RASPILUM Control Interface — Laboratório do Futuro</div>
      </div>
      <div className="clock" id="clock">{clock}</div>
    </header>
  )
}

export default Topbar
