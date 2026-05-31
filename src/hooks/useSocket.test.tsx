import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useSocket } from "./useSocket";
import { useRoomStore } from "../store/useRoomStore";

describe("useSocket", () => {
  beforeEach(() => {
    localStorage.clear();
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
      reactions: [],
      isChatOpen: true,
      isSelfViewHidden: false,
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
});
