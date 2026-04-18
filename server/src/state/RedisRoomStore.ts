/**
 * @fileoverview Redis RoomStore stub for Phase 2.
 * @module state/RedisRoomStore
 */

import type { RoomStore } from './RoomStore.js';
import type { Room, RoomUser, JoinRequest } from './RoomManager.js';

/**
 * Stub implementation for future Redis-backed room storage.
 * Will be implemented in Phase 2 for horizontal scaling.
 */
export class RedisRoomStore implements RoomStore {
  createRoom(_room: Room): void {
    throw new Error('RedisRoomStore not implemented. Use MemoryRoomStore for v1.');
  }

  getRoom(_code: string): Room | undefined {
    throw new Error('RedisRoomStore not implemented.');
  }

  updateRoom(_code: string, _room: Room): void {
    throw new Error('RedisRoomStore not implemented.');
  }

  deleteRoom(_code: string): boolean {
    throw new Error('RedisRoomStore not implemented.');
  }

  findUserRoom(_userId: string): { room: Room; user: RoomUser } | null {
    throw new Error('RedisRoomStore not implemented.');
  }

  findPendingRequestBySocketId(_socketId: string): { room: Room; request: JoinRequest } | null {
    throw new Error('RedisRoomStore not implemented.');
  }

  getAllRooms(): IterableIterator<[string, Room]> {
    throw new Error('RedisRoomStore not implemented.');
  }

  getStats(): { totalRooms: number; activeRooms: number; waitingRooms: number } {
    throw new Error('RedisRoomStore not implemented.');
  }

  clear(): void {
    throw new Error('RedisRoomStore not implemented.');
  }
}
