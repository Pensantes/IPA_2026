function ChatPanel({ messages, input, setInput, onSend, disabled }) {
  return (
    <aside className="panel chat-panel">
      <div className="panel-head">
        <div className="panel-title">Chat</div>
        <div className="panel-flag ok">Ouvindo</div>
      </div>

      <div className="chat-log">
        {messages.map((message) => (
          <div key={message.id} className={`msg ${message.who === 'JAIME' ? 'jaime' : 'user'}`}>
            <span className="who">{message.who}</span>
            {message.text}
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          id="chatInput"
          type="text"
          placeholder="Digite ou fale..."
          value={input}
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSend()
          }}
        />
        <button type="button" id="sendBtn" onClick={onSend} disabled={disabled}>
          {disabled ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </aside>
  )
}

export default ChatPanel
