/**
 * @fileoverview Settings store — persists default nickname locally.
 * @module stores/settingsStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  defaultNickname: string;
  preferDarkMode: boolean;
  enableNotifications: boolean;

  setDefaultNickname: (nickname: string) => void;
  setPreferDarkMode: (value: boolean) => void;
  setEnableNotifications: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultNickname: '',
      preferDarkMode: true,
      enableNotifications: true,

      setDefaultNickname: (nickname) => set({ defaultNickname: nickname }),
      setPreferDarkMode: (value) => set({ preferDarkMode: value }),
      setEnableNotifications: (value) => set({ enableNotifications: value }),
    }),
    {
      name: 'cinepair-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
