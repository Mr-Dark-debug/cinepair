import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Users, Send, Smile, CornerDownRight, X, Shield, VolumeX, Trash2 } from "lucide-react";
import { useRoomStore, ChatMessage } from "../store/useRoomStore";
import { useSocket } from "../hooks/useSocket";

export const ChatSidebar: React.FC = () => {
  const store = useRoomStore();
  const socketService = useSocket();
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const [text, setText] = useState("");
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  
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

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojiDrawer(false);
  };

  const currentSocketId = store.participants.find(p => p.nickname === store.nickname)?.id;

  const popularEmojis = ["😀", "😂", "🥰", "👍", "🔥", "🎉", "😮", "🎬", "🍿", "💖"];

  return (
    <div
      className={`flex flex-col bg-zinc-950 border-l border-zinc-800 transition-all duration-300 ${
        store.isChatOpen ? "w-80 md:w-96" : "w-0 overflow-hidden border-l-0"
      } h-full select-none`}
    >
      {/* 1. Header Tabs Switcher (replica of Reference Image switch pane) */}
      <div className="flex border-b border-zinc-800 p-2">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 flex justify-center items-center py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all duration-200 ${
            activeTab === "chat"
              ? "bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-inner"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Room Chat
        </button>
        <button
          onClick={() => setActiveTab("participants")}
          className={`flex-1 flex justify-center items-center py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all duration-200 ${
            activeTab === "participants"
              ? "bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-inner"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Users className="w-4 h-4 mr-2" />
          Participant
        </button>
      </div>

      {/* 2. Content Tabs */}
      {activeTab === "chat" ? (
        /* --- CHAT VIEW --- */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {store.messages.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-center space-y-2 p-6">
                <div className="p-3 bg-zinc-900 rounded-full border border-zinc-800">
                  <MessageSquare className="w-6 h-6 text-zinc-500" />
                </div>
                <span className="text-xs text-zinc-400 font-medium">No messages yet</span>
                <p className="text-[11px] text-zinc-600 max-w-[200px]">Send a message, share a screenshot, or react to watch party events.</p>
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
                      <span className="bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-400 px-3 py-1 rounded-full font-medium">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                    {/* Render threaded parent reference card */}
                    {parentMessage && (
                      <div className="flex items-center space-x-1 pl-2 mb-0.5 text-[10px] text-zinc-500">
                        <CornerDownRight className="w-3.5 h-3.5" />
                        <span>replying to {parentMessage.sender_nickname}</span>
                      </div>
                    )}

                    <div className="flex items-baseline space-x-2 px-1">
                      <span className="text-[10px] font-bold text-zinc-400">
                        {msg.sender_nickname}
                      </span>
                      <span className="text-[9px] text-zinc-600">
                        {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Chat Bubble Container (zinc matte rounded container) */}
                    <div
                      onClick={() => setReplyTarget(msg)}
                      className={`relative max-w-[85%] px-4 py-2.5 rounded-2xl border text-xs cursor-pointer select-text transition-transform active:scale-[0.98] ${
                        isMe
                          ? "bg-zinc-800 border-zinc-700 text-zinc-100 rounded-tr-none"
                          : "bg-zinc-900 border-zinc-800 text-zinc-300 rounded-tl-none"
                      }`}
                    >
                      {/* Nested Parent Quote Block inside bubble */}
                      {parentMessage && (
                        <div className="bg-black/30 px-2 py-1 rounded-md border border-white/5 text-[10px] text-zinc-400 mb-1.5 line-clamp-2 italic">
                          "{parentMessage.text}"
                        </div>
                      )}

                      {/* Embed screenshot thumbnail if base64 exists */}
                      {msg.image_data && (
                        <div className="mb-1.5 rounded-lg border border-white/10 overflow-hidden max-h-[140px] max-w-[200px]">
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

                      <p className="leading-relaxed break-words">{msg.text}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Emoji Floating Pop Drawer */}
          {showEmojiDrawer && (
            <div className="flex justify-around items-center bg-zinc-900 border-t border-zinc-800 p-2">
              {popularEmojis.map((e) => (
                <button
                  key={e}
                  onClick={() => handleEmojiSelect(e)}
                  className="text-lg hover:scale-125 transition-transform duration-200"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Active Reply Banner Target (re-closable) */}
          {replyTarget && (
            <div className="flex justify-between items-center bg-zinc-900 border-t border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-400 select-none">
              <span className="truncate">Replying to message by <strong>{replyTarget.sender_nickname}</strong></span>
              <button
                onClick={() => setReplyTarget(null)}
                className="p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Text Input Panel Area */}
          <form onSubmit={handleSendMessage} className="border-t border-zinc-800 p-4 bg-zinc-950 flex space-x-2 items-center">
            <button
              type="button"
              onClick={() => setShowEmojiDrawer(!showEmojiDrawer)}
              className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-800"
            >
              <Smile className="w-5 h-5" />
            </button>
            
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type message here..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
            />
            
            <button
              type="submit"
              className="p-2.5 bg-rose-500 hover:bg-rose-600 rounded-xl text-white transition-colors duration-200 shadow-premium"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </form>
        </div>
      ) : (
        /* --- PARTICIPANTS LIST VIEW --- */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-900 pb-2">
            <span>Participants ({store.participants.length})</span>
            <span>Controls</span>
          </div>

          <div className="space-y-2">
            {store.participants.map((p) => {
              const isSelf = p.id === currentSocketId;
              
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-zinc-900/40 border border-zinc-900 px-3.5 py-3 rounded-2xl hover:border-zinc-800 transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3 truncate">
                    {/* Mini initials icon */}
                    <div className="flex justify-center items-center bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold w-8 h-8 rounded-full text-[10px]">
                      {p.nickname.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-semibold text-zinc-200 truncate flex items-center">
                        {p.nickname}
                        {p.is_admin && <Shield className="w-3.5 h-3.5 text-amber-400 ml-1 inline fill-amber-400/25" />}
                      </span>
                      {isSelf && <span className="text-[10px] text-zinc-500">Local Client</span>}
                    </div>
                  </div>

                  {/* Admin tools (Moderations) */}
                  <div className="flex items-center space-x-1">
                    {store.isAdmin && !isSelf && (
                      <>
                        <button
                          onClick={() => socketService.muteUser(p.id)}
                          title="Force Mute"
                          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-rose-400 transition-colors"
                        >
                          <VolumeX className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => socketService.transferAdmin(p.id)}
                          title="Transfer Admin"
                          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-amber-400 transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => socketService.kickUser(p.id)}
                          title="Kick User"
                          className="p-1.5 hover:bg-rose-500/10 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
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
