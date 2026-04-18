/**
 * @fileoverview Backward-compatible re-export of sliced stores.
 * Components should prefer importing individual slices directly.
 * @module stores/roomStore
 */

export { useRoomSlice as useRoomStore } from './roomSlice';
export type { RoomUser, JoinRequest, AppScreen } from './roomSlice';
export type { ChatMessage } from './chatSlice';
