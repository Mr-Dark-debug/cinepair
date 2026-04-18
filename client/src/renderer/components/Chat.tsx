/**
 * @fileoverview Chat sidebar component for CinePair.
 * Real-time chat with emoji support, message history, and auto-scroll.
 * @module components/Chat
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Smile } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useChatSlice, ChatMessage } from '../stores/chatSlice';

/** Props for the Chat component */
interface ChatProps {
  /** Callback to send a message */
  onSendMessage: (message: string) => void;
}

/**
 * Chat sidebar — real-time messaging between the two users.
 * Features emoji picker, auto-scroll, and message bubbles.
 */
export default function Chat({ onSendMessage }: ChatProps): JSX.Element {
  const messages = useChatSlice((s) => s.messages);

  const [inputValue, setInputValue] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Auto-scroll to the latest message.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Sends the current input as a chat message.
   */
  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInputValue('');
    setShowEmoji(false);
    inputRef.current?.focus();
  }, [inputValue, onSendMessage]);

  /**
   * Handles Enter key press to send messages.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /**
   * Formats a timestamp for display.
   */
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <h3 className="font-semibold text-sm">Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-text-secondary/40 text-sm py-12">
            <p>No messages yet</p>
            <p className="mt-1">Say hi to your partner! 💜</p>
          </div>
        )}

        {messages.map((msg: ChatMessage) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
          >
            {/* Sender name */}
            <span className="text-xs text-text-secondary mb-1 px-1">
              {msg.isSelf ? 'You' : msg.senderNickname}
            </span>
            {/* Message bubble */}
            <div className={msg.isSelf ? 'chat-bubble-self' : 'chat-bubble-other'}>
              {msg.message}
            </div>
            {/* Timestamp */}
            <span className="text-[10px] text-text-secondary/40 mt-0.5 px-1">
              {formatTime(msg.timestamp)}
            </span>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="absolute bottom-16 right-4 z-50 animate-scale-in">
          <EmojiPicker
            theme={Theme.DARK}
            width={300}
            height={350}
            onEmojiClick={(emojiData) => {
              setInputValue((prev) => prev + emojiData.emoji);
              inputRef.current?.focus();
            }}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className={`p-2 rounded-full transition-colors ${
              showEmoji ? 'text-accent-purple bg-accent-purple/10' : 'text-text-secondary hover:text-text-primary'
            }`}
            title="Emoji"
          >
            <Smile size={20} />
          </button>

          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-void border border-border-subtle rounded-full px-4 py-2 text-sm
                       text-text-primary placeholder-text-secondary/50
                       focus:outline-none focus:border-accent-purple/50 transition-colors"
          />

          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="p-2 rounded-full bg-accent-purple text-white
                       hover:bg-accent-purple-hover transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
