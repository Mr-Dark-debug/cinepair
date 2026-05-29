import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Users, Send, CornerDownRight, X, Shield, VolumeX, Trash2 } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useRoomStore, ChatMessage } from "../store/useRoomStore";
import { useSocket } from "../hooks/useSocket";

export const ChatSidebar: React.FC = () => {
  const store = useRoomStore();
  const socketService = useSocket();
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const [text, setText] = useState("");
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  
  // Interactive reaction popover states
  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(null); // messageId with open menu
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [store.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    socketService.sendChatMessage(text.trim(), replyTarget?.id || null);
    setText("");
    setReplyTarget(null);
  };

  const handleReactToMessage = (messageId: string, emoji: string) => {
    socketService.sendMessageReaction(messageId, emoji);
    setActiveReactionMenu(null);
  };

  const currentSocketId = store.participants.find(p => p.nickname === store.nickname)?.id;


  return (
    <div
      className={`flex flex-col bg-white border-l border-zinc-200 transition-all duration-300 ${
        store.isChatOpen ? "w-80 md:w-96 border-l" : "w-0 overflow-hidden border-l-0"
      } h-full select-none shadow-premium z-80 absolute right-0 top-0 md:relative`}
    >
      {/* 1. Header Tabs Switcher (Sleek figma-style pill tabs switcher) */}
      <div className="flex bg-surface-soft border border-hairline p-1 rounded-full m-3.5 shadow-sm">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 flex justify-center items-center py-2 rounded-full text-xs font-bold uppercase transition-all duration-200 cursor-pointer ${
            activeTab === "chat"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-zinc-500 hover:text-ink"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 mr-2" />
          Room Chat
        </button>
        <button
          onClick={() => setActiveTab("participants")}
          className={`flex-1 flex justify-center items-center py-2 rounded-full text-xs font-bold uppercase transition-all duration-200 cursor-pointer ${
            activeTab === "participants"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-zinc-500 hover:text-ink"
          }`}
        >
          <Users className="w-3.5 h-3.5 mr-2" />
          Participants
        </button>
      </div>

      {/* 2. Content Tabs */}
      {activeTab === "chat" ? (
        /* --- CHAT VIEW --- */
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {store.messages.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-center space-y-2 p-6">
                <div className="p-3 bg-zinc-50 rounded-full border border-zinc-150 text-zinc-400">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <span className="text-xs text-zinc-600 font-bold">No messages yet</span>
                <p className="text-[10px] text-zinc-400 max-w-[200px] leading-relaxed">
                  Send a message, hover bubbles to react, or screengrab watch party moments.
                </p>
              </div>
            ) : (
              store.messages.map((msg) => {
                const isSystem = msg.sender_id === "system";
                const isMe = msg.sender_id === currentSocketId;
                const parentMessage = msg.reply_to 
                  ? store.messages.find(m => m.id === msg.reply_to)
                  : null;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center py-1">
                      <span className="bg-zinc-100 border border-zinc-200 text-[9px] text-zinc-500 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                    
                    {/* Render threaded parent quote banner */}
                    {parentMessage && (
                      <div className="flex items-center space-x-1 pl-2 mb-0.5 text-[9px] text-zinc-400 font-semibold">
                        <CornerDownRight className="w-3 h-3" />
                        <span>replying to {parentMessage.sender_nickname}</span>
                      </div>
                    )}

                    <div className="flex items-baseline space-x-2 px-1">
                      <span className="text-[10px] font-bold text-zinc-500">
                        {msg.sender_nickname}
                      </span>
                      <span className="text-[8px] text-zinc-400 font-semibold">
                        {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Chat Bubble Container (clean light rounded containers) */}
                    <div className="relative group/bubble max-w-[85%]">
                      
                      {/* Interactive Hover Actions Menu (Slack style overlay toolbar!) */}
                      <div className="absolute -top-3.5 right-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 z-20 flex bg-white border border-zinc-250 shadow-sm rounded-lg p-0.5 space-x-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveReactionMenu(activeReactionMenu === msg.id ? null : msg.id)}
                          className="p-1 hover:bg-zinc-55 hover:text-zinc-800 text-zinc-450 rounded transition-colors text-[10px]"
                          title="Add Reaction"
                        >
                          😃
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyTarget(msg)}
                          className="p-1 hover:bg-zinc-55 hover:text-zinc-800 text-zinc-450 rounded transition-colors"
                          title="Reply in Thread"
                        >
                          <CornerDownRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Floating Emoji Picker Popover panel (when active) */}
                      {activeReactionMenu === msg.id && (
                        <div className="absolute bottom-full mb-2 right-0 z-30 shadow-premium animate-fade-in">
                          <div className="relative">
                            <EmojiPicker
                              theme={Theme.LIGHT}
                              skinTonesDisabled
                              onEmojiClick={(emojiData) => handleReactToMessage(msg.id, emojiData.emoji)}
                              width={280}
                              height={320}
                            />
                            <button
                              type="button"
                              onClick={() => setActiveReactionMenu(null)}
                              className="absolute top-2 right-2 bg-white/90 hover:bg-zinc-100 border border-zinc-200 text-ink rounded-full p-1 cursor-pointer z-50 shadow-sm transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div
                        className={`px-4 py-2.5 rounded-md border text-xs leading-relaxed select-text font-medium shadow-sm ${
                          isMe
                            ? "bg-block-cream border-hairline text-ink rounded-tr-none"
                            : "bg-surface-soft border-hairline text-ink rounded-tl-none"
                        }`}
                      >
                        {/* Thread quote text block */}
                        {parentMessage && (
                          <div className="px-2.5 py-1 rounded-md text-[9px] mb-1.5 line-clamp-1 border italic bg-white/75 border-hairline text-zinc-500">
                            "{parentMessage.text}"
                          </div>
                        )}

                        {/* Screenshot thumbnail embed */}
                        {msg.image_data && (
                          <div className="mb-1.5 rounded-md border border-hairline overflow-hidden max-h-[140px] max-w-[200px]">
                            <img
                              src={msg.image_data}
                              alt="Shared Screenshot"
                              className="w-full h-full object-cover hover:scale-105 cursor-zoom-in transition-transform duration-300"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  const link = document.createElement("a");
                                  link.href = msg.image_data!;
                                  link.download = `CinePair-screenshot-${Date.now()}.png`;
                                  link.click();
                              }}
                            />
                          </div>
                        )}
                        <p className="break-words leading-relaxed">{msg.text}</p>
                      </div>

                      {/* Render Message Reactions Pills counts list directly below bubble (Slack style) */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? "justify-end" : "justify-start"}`}>
                          {Object.entries(msg.reactions).map(([emoji, usersList]) => {
                            const hasLocalReacted = usersList.some(u => u.id === currentSocketId);
                            const namesList = usersList.map(u => u.nickname).join(", ");
                            
                            return (
                              <div
                                key={emoji}
                                onClick={() => handleReactToMessage(msg.id, emoji)}
                                title={namesList}
                                className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-[10px] cursor-pointer transition-all active:scale-95 select-none font-bold ${
                                  hasLocalReacted
                                    ? "bg-rose-50 border-rose-200 text-rose-600 shadow-inner"
                                    : "bg-zinc-50 border-zinc-200 text-zinc-650 hover:bg-zinc-100"
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{usersList.length}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>

                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Active Reply Banner Target (re-closable) */}
          {replyTarget && (
            <div className="flex justify-between items-center bg-zinc-50 border-t border-zinc-150 px-4 py-2 text-[10px] text-zinc-500 select-none">
              <span className="truncate">Replying to message by <strong>{replyTarget.sender_nickname}</strong></span>
              <button
                onClick={() => setReplyTarget(null)}
                className="p-1 hover:bg-zinc-150 rounded-full text-zinc-400 hover:text-zinc-650"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Text Input Panel Area */}
          <form onSubmit={handleSendMessage} className="border-t border-zinc-150 p-4 bg-zinc-50 flex space-x-2 items-center relative">
            
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type message here..."
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors font-medium"
            />
            
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowInputEmojiPicker(!showInputEmojiPicker)}
                className="p-2 hover:bg-zinc-200 text-zinc-650 rounded-xl cursor-pointer transition-colors text-sm"
                title="Choose Emoji"
              >
                😊
              </button>
              {showInputEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-3 z-50 shadow-premium">
                  <div className="relative">
                    <EmojiPicker
                      theme={Theme.LIGHT}
                      skinTonesDisabled
                      onEmojiClick={(emojiData) => {
                        setText((prev) => prev + emojiData.emoji);
                        setShowInputEmojiPicker(false);
                      }}
                      width={280}
                      height={320}
                    />
                    <button
                      type="button"
                      onClick={() => setShowInputEmojiPicker(false)}
                      className="absolute top-2 right-2 bg-white/90 hover:bg-zinc-100 border border-zinc-200 text-ink rounded-full p-1 cursor-pointer z-50 shadow-sm transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <button
              type="submit"
              className="p-2.5 bg-rose-500 hover:bg-rose-600 rounded-xl text-white cursor-pointer transition-colors duration-200 shadow-premium"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </form>
        </div>
      ) : (
        /* --- PARTICIPANTS LIST VIEW --- */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          <div className="flex items-center justify-between text-[9px] text-zinc-400 uppercase tracking-widest font-bold border-b border-zinc-100 pb-2">
            <span>Participants ({store.participants.length})</span>
            <span>Controls</span>
          </div>

          <div className="space-y-2">
            {store.participants.map((p) => {
              const isSelf = p.id === currentSocketId;
              
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-zinc-50 border border-zinc-100 px-3.5 py-3 rounded-2xl hover:border-zinc-200 transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="flex justify-center items-center bg-white border border-zinc-200 text-zinc-700 font-bold w-8 h-8 rounded-full text-[10px] shadow-sm">
                      {p.nickname.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-bold text-zinc-800 truncate flex items-center">
                        {p.nickname}
                        {p.is_admin && <Shield className="w-3.5 h-3.5 text-amber-500 ml-1 inline fill-amber-500/10" />}
                      </span>
                      {isSelf && <span className="text-[9px] text-zinc-400 font-semibold">Local Client</span>}
                    </div>
                  </div>

                  {/* Admin tools */}
                  <div className="flex items-center space-x-1">
                    {store.isAdmin && !isSelf && (
                      <>
                        <button
                          onClick={() => socketService.muteUser(p.id)}
                          title="Force Mute"
                          className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-rose-500 transition-colors"
                        >
                          <VolumeX className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => socketService.transferAdmin(p.id)}
                          title="Transfer Admin"
                          className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-amber-500 transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => socketService.kickUser(p.id)}
                          title="Kick User"
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-zinc-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
