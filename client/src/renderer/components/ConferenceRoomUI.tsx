import { useState } from 'react';

const Header = () => (
  <div className="flex justify-between items-center px-6 py-4">
    <div className="flex items-center gap-3 bg-slate-800/80 rounded-full px-4 py-2 text-slate-200 border border-slate-700 shadow-sm backdrop-blur">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
      <span className="font-mono text-sm tracking-widest font-medium">01:28:36</span>
    </div>
    <button className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-full transition-all border border-transparent hover:border-slate-700">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  </div>
);

const ParticipantStrip = () => {
  const participants = [
    { name: 'Noman Islam', initial: 'NI', color: 'bg-indigo-500', active: false, muted: true },
    { name: 'Raja Pakshe', initial: 'RP', color: 'bg-purple-500', active: true, muted: false },
    { name: 'You', initial: 'Y', color: 'bg-emerald-500', active: false, muted: false },
    { name: 'Najmus Joy', initial: 'NJ', color: 'bg-rose-500', active: false, muted: true },
  ];

  return (
    <div className="flex justify-center gap-4 px-6 mb-2">
      {participants.map((p, i) => (
        <div key={i} className={`relative flex flex-col items-center gap-2 px-4 py-2 rounded-2xl transition-all duration-300 ${p.active ? 'bg-slate-800/80 shadow-lg ring-1 ring-slate-600 scale-105' : 'hover:bg-slate-800/50'}`}>
          <div className="relative">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner border-2 ${p.active ? 'border-blue-400' : 'border-transparent'} ${p.color}`}>
              {p.initial}
            </div>
            {p.muted && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-slate-900 rounded-full flex items-center justify-center border border-slate-700">
                <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" strokeLinecap="round" /></svg>
              </div>
            )}
            {p.active && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>
              </div>
            )}
          </div>
          <span className="text-xs text-slate-300 font-medium tracking-wide bg-slate-900/50 px-2 py-0.5 rounded-md">{p.name}</span>
        </div>
      ))}
    </div>
  );
};

const MainStage = () => (
  <div className="flex-1 flex items-center justify-center p-6 pb-28">
    <div className="w-full max-w-6xl aspect-video rounded-3xl bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden relative group">
      {/* Placeholder content for active speaker/presentation */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-400 via-slate-900 to-slate-900"></div>
        <div className="w-40 h-40 rounded-full bg-slate-700/50 flex items-center justify-center backdrop-blur-md shadow-2xl ring-1 ring-white/10 z-10">
          <span className="text-6xl font-bold text-slate-300">RP</span>
        </div>
      </div>

      {/* UI overlays on the main stage */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20 transition-opacity opacity-100 group-hover:opacity-100">
        <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700 shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-slate-200 font-medium">Raja Pakshe presenting</span>
        </div>
      </div>
    </div>
  </div>
);

const ChatSidebar = ({ isVisible }: { isVisible: boolean }) => {
  if (!isVisible) return null;
  return (
    <div className="w-96 h-full border-l border-slate-800 bg-slate-900/95 flex flex-col shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-30">
      <div className="p-5 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-3">
          <span className="p-2 bg-slate-800 rounded-lg text-blue-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
          </span>
          Conversation
        </h2>
        <div className="flex gap-4 text-sm font-medium">
          <button className="text-blue-400 border-b-2 border-blue-400 pb-1">Chat</button>
          <button className="text-slate-500 hover:text-slate-300 pb-1">Members</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
        {/* Date Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-800"></div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Today</span>
          <div className="flex-1 h-px bg-slate-800"></div>
        </div>

        {/* Message 1 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-slate-400 ml-11 font-medium">Noman Islam</span>
          <div className="flex items-end gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs text-white shrink-0 font-bold shadow-sm">NI</div>
            <div className="bg-slate-800 p-3.5 rounded-2xl rounded-bl-sm text-sm text-slate-200 max-w-[85%] border border-slate-700/50 shadow-sm leading-relaxed">
              Hello, Did You Check it yet? If You can do it.
            </div>
          </div>
          <span className="text-[10px] text-slate-500 ml-11 font-medium">10:24 AM</span>
        </div>

        {/* Message 2 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-slate-400 ml-11 font-medium">Najmus Joy</span>
          <div className="flex items-end gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-xs text-white shrink-0 font-bold shadow-sm">NJ</div>
            <div className="bg-slate-800 p-3.5 rounded-2xl rounded-bl-sm text-sm text-slate-200 max-w-[85%] border border-slate-700/50 shadow-sm">
              <div className="w-full h-24 bg-slate-700 rounded-lg mb-2 flex items-center justify-center text-slate-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              Have a look?
            </div>
          </div>
          <span className="text-[10px] text-slate-500 ml-11 font-medium">10:26 AM</span>
        </div>

        {/* Message 3 (Self) */}
        <div className="flex flex-col gap-1.5 items-end mt-2">
          <div className="flex items-end gap-3 flex-row-reverse">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-white shrink-0 font-bold shadow-sm">Y</div>
            <div className="bg-emerald-600/20 text-emerald-100 p-3.5 rounded-2xl rounded-br-sm text-sm max-w-[85%] border border-emerald-500/30 shadow-sm leading-relaxed">
              I already sent this report. Check it now.
            </div>
          </div>
          <span className="text-[10px] text-slate-500 mr-11 font-medium">10:28 AM</span>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-5 bg-slate-900 border-t border-slate-800">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Write Your Message..."
            className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3.5 pl-5 pr-14 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
          />
          <button className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors shadow-md">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const ControlDock = ({ onToggleChat, isChatVisible }: { onToggleChat: () => void, isChatVisible: boolean }) => (
  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2.5 rounded-2xl bg-slate-800/90 backdrop-blur-xl border border-slate-700/60 shadow-2xl z-40">
    <button className="flex flex-col items-center gap-1.5 p-3 min-w-[76px] rounded-xl hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all">
      <div className="p-1 rounded-lg text-yellow-500 bg-yellow-500/10">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
      </div>
      <span className="text-[10px] font-semibold tracking-wide">Highlight</span>
    </button>

    <button onClick={onToggleChat} className={`flex flex-col items-center gap-1.5 p-3 min-w-[76px] rounded-xl transition-all ${isChatVisible ? 'bg-slate-700 text-slate-100' : 'hover:bg-slate-700 text-slate-400 hover:text-slate-100'} relative`}>
      <div className="absolute top-2 right-4 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-800"></div>
      <div className="p-1">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
      </div>
      <span className="text-[10px] font-semibold tracking-wide">Chatting</span>
    </button>

    <div className="w-px h-10 bg-slate-700 mx-2"></div>

    <div className="flex items-center gap-3 px-2">
      <button className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600 transition-all hover:scale-105">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
      </button>
      <button className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all hover:scale-105">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 14h14M4 18h16a1 1 0 001-1V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1z" /></svg>
      </button>
      <button className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600 transition-all hover:scale-105">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      </button>
    </div>

    <div className="w-px h-10 bg-slate-700 mx-2"></div>

    <button className="flex flex-col items-center gap-1.5 p-3 min-w-[76px] rounded-xl hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all">
      <div className="p-1">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      </div>
      <span className="text-[10px] font-semibold tracking-wide">Attendee</span>
    </button>
  </div>
);

export default function ConferenceRoomUI() {
  const [isChatVisible, setIsChatVisible] = useState(true);

  return (
    <div className="w-full h-screen bg-slate-900 font-sans flex overflow-hidden selection:bg-blue-500/30 text-slate-200">
      {/* Left Area (Header, Participants, Stage, Control Dock) */}
      <div className="flex-1 flex flex-col relative min-w-0 transition-all duration-300">
        <Header />
        <ParticipantStrip />
        <MainStage />
        <ControlDock onToggleChat={() => setIsChatVisible(!isChatVisible)} isChatVisible={isChatVisible} />
      </div>

      {/* Right Sidebar */}
      <ChatSidebar isVisible={isChatVisible} />
    </div>
  );
}
