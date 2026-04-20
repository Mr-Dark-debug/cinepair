import { create } from 'zustand';

type LayoutMode = 'grid' | 'speaker' | 'pip';
type ModalType = 'settings' | 'join-approval' | 'none';

interface UIState {
  isChatOpen: boolean;
  isSettingsOpen: boolean;
  isParticipantListOpen: boolean;
  activeModal: ModalType;
  layoutMode: LayoutMode;

  toggleChat: () => void;
  setChatOpen: (isOpen: boolean) => void;
  toggleSettings: () => void;
  setSettingsOpen: (isOpen: boolean) => void;
  toggleParticipantList: () => void;
  setParticipantListOpen: (isOpen: boolean) => void;
  setActiveModal: (modal: ModalType) => void;
  setLayoutMode: (mode: LayoutMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isChatOpen: false,
  isSettingsOpen: false,
  isParticipantListOpen: false,
  activeModal: 'none',
  layoutMode: 'grid',

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen, isParticipantListOpen: false })),
  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
  
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, activeModal: state.isSettingsOpen ? 'none' : 'settings' })),
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen, activeModal: isOpen ? 'settings' : 'none' }),
  
  toggleParticipantList: () => set((state) => ({ isParticipantListOpen: !state.isParticipantListOpen, isChatOpen: false })),
  setParticipantListOpen: (isOpen) => set({ isParticipantListOpen: isOpen }),
  
  setActiveModal: (modal) => set({ activeModal: modal, isSettingsOpen: modal === 'settings' }),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
}));
