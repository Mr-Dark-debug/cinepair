/**
 * @fileoverview Room state store interface.
 * Decoupled from implementation to support future Redis migration.
 * @module state/RoomStore
 */

import type { Room, RoomUser, JoinRequest } from './RoomManager.js';

/**
 * Abstract interface for room state persistence.
 * MemoryRoomStore implements this in-memory.
 * RedisRoomStore will implement this in Phase 2.
 */
export interface RoomStore {
  /** Create and persist a new room */
  createRoom(room: Room): void;

  /** Get a room by code */
  getRoom(code: string): Room | undefined;

  /** Update an existing room */
  updateRoom(code: string, room: Room): void;

  /** Delete a room */
  deleteRoom(code: string): boolean;

  /** Find which room a user is in by userId */
  findUserRoom(userId: string): { room: Room; user: RoomUser } | null;

  /** Find a pending request by socket ID across all rooms */
  findPendingRequestBySocketId(socketId: string): { room: Room; request: JoinRequest } | null;

  /** Get all rooms (for cleanup) */
  getAllRooms(): IterableIterator<[string, Room]>;

  /** Get room count stats */
  getStats(): { totalRooms: number; activeRooms: number; waitingRooms: number };

  /** Clear all rooms */
  clear(): void;
}
