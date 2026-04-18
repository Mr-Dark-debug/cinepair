/**
 * @fileoverview Chat state slice with ring buffer and dedup.
 * @module stores/chatSlice
 */

import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  clientMessageId?: string;
  senderId: string;
  senderNickname: string;
  message: string;
  timestamp: number;
  isSelf: boolean;
}

interface ChatSliceState {
  messages: ChatMessage[];

  addMessage: (message: ChatMessage) => void;
  resetChat: () => void;
}

const MAX_MESSAGES = 500;

export const useChatSlice = create<ChatSliceState>((set) => ({
  messages: [],

  addMessage: (message) =>
    set((state) => {
      // Dedup by clientMessageId
      if (message.clientMessageId) {
        const exists = state.messages.some(
          (m) => m.clientMessageId === message.clientMessageId
        );
        if (exists) return state;
      }

      const newMessages = [...state.messages, message];
      // Ring buffer: keep last N messages
      if (newMessages.length > MAX_MESSAGES) {
        return { messages: newMessages.slice(-MAX_MESSAGES) };
      }
      return { messages: newMessages };
    }),

  resetChat: () => set({ messages: [] }),
}));
