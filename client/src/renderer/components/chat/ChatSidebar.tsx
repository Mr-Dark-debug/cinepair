import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Smile, MessageSquare } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useChatSlice, ChatMessage } from '@/stores/chatSlice';
import { Input } from '@/components/ui/Input';

interface ChatSidebarProps {
  isVisible: boolean;
  onSendMessage: (message: string) => void;
}

export function ChatSidebar({ isVisible, onSendMessage }: ChatSidebarProps) {
  const messages = useChatSlice((s) => s.messages);
  const [inputValue, setInputValue] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'members'>('chat');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputValue('');
    setShowEmoji(false);
    inputRef.current?.focus();
  }, [inputValue, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isVisible) return null;

  return (
    <div className="w-80 md:w-96 h-full border-l border-surface bg-surface/50 backdrop-blur-md flex flex-col shrink-0 z-30 transition-all">
      {/* Header Tabs */}
      <div className="p-4 border-b border-surface-hover bg-surface/80 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-3">
          <span className="p-2 bg-background rounded-lg text-primary">
            <MessageSquare className="w-5 h-5" />
          </span>
          Room Panel
        </h2>
        <div className="flex gap-4 text-sm font-medium">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`pb-1 border-b-2 transition-colors ${activeTab === 'chat' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
          >
            Chat
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            className={`pb-1 border-b-2 transition-colors ${activeTab === 'members' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
          >
            Members
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-text-secondary/50">
                <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                <p>No messages yet</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            )}

            {messages.map((msg: ChatMessage, idx) => {
              const showName = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
              
              return (
                <div key={msg.id} className={`flex flex-col gap-1 ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                  {showName && !msg.isSelf && (
                    <span className="text-xs text-text-secondary ml-2 font-medium">{msg.senderNickname}</span>
                  )}
                  {showName && msg.isSelf && (
                    <span className="text-xs text-text-secondary mr-2 font-medium">You</span>
                  )}
                  <div className={`px-4 py-2 text-sm max-w-[85%] leading-relaxed ${
                    msg.isSelf 
                      ? 'bg-primary/20 text-text-primary border border-primary/30 rounded-2xl rounded-br-sm' 
                      : 'bg-surface text-text-primary border border-surface-hover rounded-2xl rounded-bl-sm'
                  }`}>
                    {msg.message}
                  </div>
                  <span className={`text-[10px] text-text-secondary/50 font-medium ${msg.isSelf ? 'mr-2' : 'ml-2'}`}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Emoji Picker */}
          {showEmoji && (
            <div className="absolute bottom-20 right-4 z-50">
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={(emojiData) => {
                  setInputValue((prev) => prev + emojiData.emoji);
                  inputRef.current?.focus();
                }}
              />
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 bg-background/50 border-t border-surface-hover backdrop-blur-md">
            <div className="relative flex items-center gap-2">
              <button
                onClick={() => setShowEmoji(!showEmoji)}
                className={`p-2 rounded-full transition-colors shrink-0 ${
                  showEmoji ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                }`}
              >
                <Smile className="w-5 h-5" />
              </button>
              
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message..."
                className="pr-12 rounded-full bg-surface border-surface-hover shadow-inner"
              />
              
              <button 
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="absolute right-1 p-1.5 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-text-secondary text-background rounded-full transition-colors shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 p-5 text-text-secondary">
          {/* Members list placeholder, ideally integrated with ParticipantList */}
          <div className="flex flex-col gap-4">
             <p className="text-sm">Room members will appear here.</p>
          </div>
        </div>
      )}
    </div>
  );
}
