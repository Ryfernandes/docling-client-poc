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
  compressingContext?: boolean;
  clearContext?: () => void;
  active: boolean;
  onCancel?: () => void;
  canceling?: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;  // Add this new prop
  canRedo?: boolean;    // Add this new prop
}

const ChatbotPanel: React.FC<ChatbotPanelProps> = ({ 
  onPromptSubmit, 
  messages, 
  loading, 
  compressingContext, 
  clearContext, 
  active, 
  onCancel, 
  canceling,
  onUndo,
  canUndo,
  onRedo,     // Add this
  canRedo     // Add this
}) => {
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
    if (!input.trim() || loading || ! active) return;
    
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
        <div className="document-actions">
          {!loading && onUndo && (
            <button className={`icon-button ${canUndo ? 'enabled' : 'disabled'} reload-icon`} onClick={onUndo} title="Undo last action" disabled={!canUndo}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6"></path>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
              </svg>
            </button>
          )}
          {!loading && onRedo && (
            <button className={`icon-button ${canRedo ? 'enabled' : 'disabled'} reload-icon`} onClick={onRedo} title="Redo last action" disabled={!canRedo}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6"></path>
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
              </svg>
            </button>
          )}
          {loading && onCancel && (
            <button className={`icon-button reload-icon ${canceling ? 'disabled' : 'enabled'}`} onClick={onCancel} title="Cancel processing" disabled={canceling}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
          {clearContext && (
            <button className="icon-button enabled reload-icon" onClick={clearContext} title="Clear conversation">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
              </svg>
            </button>
          )}
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
            <span className={`${compressingContext ? 'compressing-message': 'thinking-message'}`}>{compressingContext ? 'Compressing context...' : 'Thinking...'}</span>
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
          disabled={!input.trim() || loading || !active}
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