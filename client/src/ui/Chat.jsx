import { useState, useRef, useEffect } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store/useGameStore';

export default function Chat() {
  const roomId = useGameStore((state) => state.roomId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleChat = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat:message', handleChat);
    return () => {
      socket.off('chat:message', handleChat);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    socket.emit('chat:send', { roomId, text: input });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-700">
      <div className="bg-slate-900/50 p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-slate-200">Chat</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`text-sm break-words ${msg.system ? msg.color || 'text-yellow-400 font-bold' : ''}`}>
            {!msg.system && (
              <span className={`font-bold mr-2 ${msg.secret ? 'text-purple-400' : 'text-slate-400'}`}>
                {msg.sender}{msg.secret && ' (secret)'}:
              </span>
            )}
            <span className={msg.secret ? 'text-purple-300' : (msg.system ? '' : 'text-slate-200')}>
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 bg-slate-900/50 border-t border-slate-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={100}
          placeholder="Guess the word..."
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>
    </div>
  );
}
