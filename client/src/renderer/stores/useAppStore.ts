import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
  defaultNickname: string;
  avatarColor: string;
  preferDarkMode: boolean;
  enableNotifications: boolean;
  customSignalingUrl: string;
  
  // Devices
  selectedMicrophoneId: string | null;
  selectedCameraId: string | null;
  selectedSpeakerId: string | null;

  setDefaultNickname: (nickname: string) => void;
  setAvatarColor: (color: string) => void;
  setPreferDarkMode: (value: boolean) => void;
  setEnableNotifications: (value: boolean) => void;
  setCustomSignalingUrl: (url: string) => void;
  
  setSelectedMicrophoneId: (id: string | null) => void;
  setSelectedCameraId: (id: string | null) => void;
  setSelectedSpeakerId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      defaultNickname: '',
      avatarColor: '#2DD4BF', // Default to Teal
      preferDarkMode: true,
      enableNotifications: true,
      customSignalingUrl: '',
      
      selectedMicrophoneId: null,
      selectedCameraId: null,
      selectedSpeakerId: null,

      setDefaultNickname: (nickname) => set({ defaultNickname: nickname }),
      setAvatarColor: (color) => set({ avatarColor: color }),
      setPreferDarkMode: (value) => set({ preferDarkMode: value }),
      setEnableNotifications: (value) => set({ enableNotifications: value }),
      setCustomSignalingUrl: (url) => set({ customSignalingUrl: url }),
      
      setSelectedMicrophoneId: (id) => set({ selectedMicrophoneId: id }),
      setSelectedCameraId: (id) => set({ selectedCameraId: id }),
      setSelectedSpeakerId: (id) => set({ selectedSpeakerId: id }),
    }),
    {
      name: 'cinepair-app-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
