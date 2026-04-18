/**
 * @fileoverview In-memory implementation of the RoomStore interface.
 * @module state/MemoryRoomStore
 */

import type { RoomStore } from './RoomStore.js';
import type { Room, RoomUser, JoinRequest } from './RoomManager.js';

export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  createRoom(room: Room): void {
    this.rooms.set(room.code, room);
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  updateRoom(code: string, room: Room): void {
    this.rooms.set(code.toUpperCase(), room);
  }

  deleteRoom(code: string): boolean {
    return this.rooms.delete(code.toUpperCase());
  }

  findUserRoom(userId: string): { room: Room; user: RoomUser } | null {
    for (const room of this.rooms.values()) {
      const user = room.users.find((u) => u.userId === userId);
      if (user) return { room, user };
    }
    return null;
  }

  findPendingRequestBySocketId(socketId: string): { room: Room; request: JoinRequest } | null {
    for (const room of this.rooms.values()) {
      const request = room.pendingRequests.find(
        (r) => r.socketId === socketId && r.status === 'pending'
      );
      if (request) return { room, request };
    }
    return null;
  }

  getAllRooms(): IterableIterator<[string, Room]> {
    return this.rooms.entries();
  }

  getStats(): { totalRooms: number; activeRooms: number; waitingRooms: number } {
    let activeRooms = 0;
    let waitingRooms = 0;
    for (const room of this.rooms.values()) {
      if (room.status === 'active') activeRooms++;
      else if (room.status === 'waiting') waitingRooms++;
    }
    return { totalRooms: this.rooms.size, activeRooms, waitingRooms };
  }

  clear(): void {
    this.rooms.clear();
  }
}
