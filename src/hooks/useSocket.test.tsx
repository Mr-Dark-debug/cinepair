import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSocket } from "./useSocket";
import { useRoomStore } from "../store/useRoomStore";

const socketMock = vi.hoisted(() => ({
  socket: {
    id: "local-sid",
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => socketMock.socket),
}));

describe("useSocket", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useRoomStore.setState({
      roomCode: null,
      nickname: null,
      participants: [],
      waitingList: [],
      isAdmin: false,
      isWaiting: false,
      messages: [],
      pinnedId: null,
      cameraEnabled: false,
      micEnabled: false,
      screenShareEnabled: false,
      screenAudioEnabled: false,
      localStream: null,
      localScreenStream: null,
      peerStreams: {},
      peerScreenStreams: {},
      peerAudioVolumes: {},
      reactions: [],
      isChatOpen: true,
      isSelfViewHidden: false,
      isAppForeground: true,
      isCompactChatOpen: false,
      toasts: [],
      unreadCount: 0,
    });
  });

  it("returns a stable service object across room state updates", () => {
    const { result } = renderHook(() => useSocket());
    const firstReference = result.current;

    act(() => {
      useRoomStore.getState().setRoomCode("ROOM42");
    });

    expect(result.current).toBe(firstReference);
  });

  it("lets the server echo chat messages instead of adding a duplicate optimistic copy", () => {
    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.connectSocket("http://signaling.test");
      useRoomStore.setState({ roomCode: "ROOM42", nickname: "Alex" });
      result.current.sendChatMessage("hello there", null);
    });

    expect(useRoomStore.getState().messages).toHaveLength(0);
    expect(socketMock.socket.emit).toHaveBeenCalledWith("chat_message", {
      room_code: "ROOM42",
      text: "hello there",
      reply_to: null,
    });
  });

  it("toggles message reactions without duplicating the same user", () => {
    useRoomStore.setState({
      messages: [{
        id: "msg-1",
        sender_id: "peer-1",
        sender_nickname: "Sam",
        text: "movie night",
        timestamp: 1,
      }],
    });

    act(() => {
      useRoomStore.getState().toggleMessageReaction("msg-1", ":like:", "local-sid", "Alex");
      useRoomStore.getState().toggleMessageReaction("msg-1", ":like:", "local-sid", "Alex");
    });

    expect(useRoomStore.getState().messages[0].reactions).toEqual({});
  });
});
