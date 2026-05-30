import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, Sun, Moon, Users, Sparkles, MessageSquare, User, Smile } from 'lucide-react';

// Connect to socket.io server
const socket = io();

// Hash nickname to get a unique beautiful gradient for the avatar
const getAvatarColor = (name = '') => {
  const colors = [
    'linear-gradient(135deg, #FF6B6B, #FF8E53)', // Sunset Red
    'linear-gradient(135deg, #4E65FF, #92EFFD)', // Cool Blue
    'linear-gradient(135deg, #11998e, #38ef7d)', // Fresh Green
    'linear-gradient(135deg, #FC466B, #3F5EFB)', // Pink-Purple
    'linear-gradient(135deg, #7F00FF, #E100FF)', // Deep Violet
    'linear-gradient(135deg, #F9D423, #FF4E50)', // Coral Sunset
  ];
  let hash = 0;
  const normalized = name.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Play a premium synth notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Elegant high-register double-ping sound
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.08); // G5
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio playback not allowed or failed:", e);
  }
};

export default function App() {
  const [name, setName] = useState(() => localStorage.getItem('chat-nickname') || 'Anonymous');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInputVal, setNameInputVal] = useState(name);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [typingFeedback, setTypingFeedback] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isSelfTyping = useRef(false);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle socket connections
  useEffect(() => {
    socket.on('clients_total', (count) => {
      setClientsTotal(count);
    });

    socket.on('chat-message', (data) => {
      setMessages((prev) => [...prev, { ...data, isOwnMessage: false, id: Date.now() + Math.random() }]);
      playNotificationSound();
    });

    socket.on('feedback', (data) => {
      setTypingFeedback(data.feedback || '');
    });

    return () => {
      socket.off('clients_total');
      socket.off('chat-message');
      socket.off('feedback');
    };
  }, []);

  // Auto scroll to bottom when messages or typing status updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingFeedback]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const data = {
      name: name.trim() || 'Anonymous',
      message: message.trim(),
      dateTime: new Date().toISOString()
    };

    // Emit event to server
    socket.emit('message', data);

    // Append to local state
    setMessages((prev) => [...prev, { ...data, isOwnMessage: true, id: Date.now() + Math.random() }]);
    setMessage('');

    // Clear typing indicator status
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('feedback', { feedback: '' });
    isSelfTyping.current = false;
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);

    // Handle typing events
    if (!isSelfTyping.current) {
      socket.emit('feedback', {
        feedback: `${name} is typing...`
      });
      isSelfTyping.current = true;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('feedback', { feedback: '' });
      isSelfTyping.current = false;
    }, 1500);
  };

  const handleInputBlur = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('feedback', { feedback: '' });
    isSelfTyping.current = false;
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSaveNickname = () => {
    const cleanName = nameInputVal.trim();
    if (cleanName) {
      setName(cleanName);
      localStorage.setItem('chat-nickname', cleanName);
    }
    setIsEditingName(false);
  };

  const handleNicknameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveNickname();
    } else if (e.key === 'Escape') {
      setNameInputVal(name);
      setIsEditingName(false);
    }
  };

  const formatTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="chat-header">
        <div className="header-brand">
          <h1>Chat</h1>
        </div>

        <div className="header-controls">
          <div className="status-badge">
            <Users size={14} />
            <span>Active: {clientsTotal}</span>
          </div>

          <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme" aria-label="Toggle Theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {/* Main chat layout */}
      <div className="chat-body">
        {/* User Nickname Section */}
        <section className="profile-bar">
          <div className="profile-info">
            <div className="avatar-preview" style={{ background: getAvatarColor(name) }}>
              {name.charAt(0).toUpperCase() || '?'}
            </div>
            {isEditingName ? (
              <div className="edit-nickname-container">
                <input
                  type="text"
                  value={nameInputVal}
                  onChange={(e) => setNameInputVal(e.target.value)}
                  onBlur={handleSaveNickname}
                  onKeyDown={handleNicknameKeyDown}
                  autoFocus
                  maxLength={20}
                  className="nickname-input"
                />
                <button className="save-nick-btn" onClick={handleSaveNickname}>Save</button>
              </div>
            ) : (
              <div className="nickname-display">
                <span className="nick-label">Talking as</span>
                <span className="nick-value" onClick={() => { setNameInputVal(name); setIsEditingName(true); }}>
                  {name}
                  <User size={13} className="edit-icon-hover" />
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Message Logs */}
        <div className="messages-wrapper">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-container">
                <MessageSquare className="empty-icon" size={32} />
              </div>
              <h3>No messages yet</h3>
              <p>Be the first to spark a conversation!</p>
            </div>
          ) : (
            <ul className="messages-list">
              {messages.map((msg) => {
                const avatarBg = getAvatarColor(msg.name);
                const initial = msg.name ? msg.name.charAt(0).toUpperCase() : '?';

                return (
                  <li
                    key={msg.id}
                    className={`message-item ${msg.isOwnMessage ? 'own-message' : 'incoming-message'}`}
                  >
                    {!msg.isOwnMessage && (
                      <div className="message-avatar" style={{ background: avatarBg }}>
                        {initial}
                      </div>
                    )}
                    <div className="message-bubble-group">
                      {!msg.isOwnMessage && <span className="message-username">{msg.name}</span>}
                      <div className="message-bubble">
                        <p className="message-text">{msg.message}</p>
                        <span className="message-time">{formatTime(msg.dateTime)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
              <div ref={messagesEndRef} />
            </ul>
          )}
        </div>

        {/* Typing indicator */}
        {typingFeedback && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <span>{typingFeedback}</span>
          </div>
        )}

        {/* Form and Input controls */}
        <form onSubmit={handleSendMessage} className="message-compose-form">
          <div className="compose-input-wrapper">
            <input
              type="text"
              value={message}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              placeholder="Type your message..."
              className="compose-input"
            />
            
            <button type="submit" disabled={!message.trim()} className="compose-send-btn" title="Send Message">
              <span className="btn-text">Send</span>
              <Send size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
