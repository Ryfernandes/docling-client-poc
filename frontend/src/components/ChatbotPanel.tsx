'use client';

import React, { useState, useRef, useEffect } from 'react';

import '@/components/styles/ChatbotPanel.css';

import ReactMarkdown from 'react-markdown';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ChatbotPanelProps {
  onPromptSubmit: (prompt: string) => void;
  messages: Message[];
  loading?: boolean;
}

const ChatbotPanel: React.FC<ChatbotPanelProps> = ({ onPromptSubmit, messages, loading }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      sender: 'user',
      timestamp: new Date()
    };
    
    setInput('');
    onPromptSubmit(userMessage.text);
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-info-bar">
        <div className="document-info">
          <span className="document-details">
            Make changes
          </span>
        </div>
      </div>
      
      <div className="messages-container">
        {messages.map((message) => (
          <div 
            key={message.id}
            className={`message ${message.sender === 'user' ? 'message-user' : 'message-bot'}`}
          >
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        ))}
        {loading && (
          <div className="message message-bot">
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <textarea
          className="message-input"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Describe your change..."
          rows={1}
        />
        <button 
          className="send-button"
          onClick={handleSendMessage}
          disabled={!input.trim() || loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatbotPanel;