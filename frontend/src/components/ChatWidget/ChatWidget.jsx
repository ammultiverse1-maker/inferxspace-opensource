import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2, FileText, Loader } from 'lucide-react';
import api from '../../api/client.js';
import { notify } from '../../utils/notify';
import MarkdownContent from '../MarkdownContent';
import './ChatWidget.css';

const ChatWidget = ({ isOpen, onToggle }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !sessionId) {
      initializeChat();
    }
  }, [isOpen, sessionId]);

  const initializeChat = async () => {
    try {
      const response = await api.post('/api/v1/support/chat/sessions', {});
      setSessionId(response.data.session_id);

      // Add welcome message
      setMessages([{
        id: 'welcome',
        sender: 'ai',
        message: "👋 Hi! I'm your InferXSpace AI assistant. I can help you with:\n\n• API integration questions\n• Model selection and pricing\n• Troubleshooting issues\n• Billing and credits\n• Platform features\n\nHow can I assist you today?",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      setMessages([{
        id: 'error',
        sender: 'ai',
        message: "Sorry, I'm having trouble connecting right now. Please try again later or create a support ticket.",
        timestamp: new Date()
      }]);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      message: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await api.post('/api/v1/support/chat/message', {
        message: userMessage.message,
        session_id: sessionId
      });

      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        message: response.data.ai_message.message,
        timestamp: new Date(),
        confidence: response.data.ai_message.confidence_score
      };

      setMessages(prev => [...prev, aiMessage]);
      setSessionId(response.data.session_id);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        message: "I apologize, but I'm having trouble responding right now. Please try again or create a support ticket for assistance.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const createSupportTicket = () => {
    // This will be implemented when we create the SupportTicketModal
    notify('info', 'Support ticket creation will be implemented next');
    onToggle();
  };

  if (!isOpen) {
    return (
      <div className="chat-widget-button" onClick={onToggle}>
        <MessageCircle size={24} />
        <span className="chat-badge">1</span>
      </div>
    );
  }

  return (
    <div className={`chat-widget ${isMinimized ? 'minimized' : ''}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">
            <MessageCircle size={20} />
          </div>
          <div>
            <h4>InferXSpace Assistant</h4>
            <span className="chat-status">Online</span>
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            className="chat-action-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            className="chat-action-btn"
            onClick={onToggle}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.sender === 'user' ? 'user' : 'ai'}`}
              >
                <div className="message-content">
                  <MarkdownContent content={msg.message} />
                </div>
                <div className="message-time">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="chat-message ai">
                <div className="message-content typing">
                  <Loader size={16} className="typing-indicator" />
                  <span>AI is typing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="chat-quick-actions">
            <button
              className="quick-action-btn"
              onClick={() => setInputMessage("How do I get started with the API?")}
            >
              🚀 Getting Started
            </button>
            <button
              className="quick-action-btn"
              onClick={() => setInputMessage("What are the API rate limits?")}
            >
              ⚡ Rate Limits
            </button>
            <button
              className="quick-action-btn"
              onClick={() => setInputMessage("How does billing work?")}
            >
              💰 Billing Help
            </button>
            <button
              className="quick-action-btn"
              onClick={createSupportTicket}
            >
              🎫 Create Ticket
            </button>
          </div>

          {/* Input */}
          <div className="chat-input">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows={1}
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
            >
              <Send size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatWidget;