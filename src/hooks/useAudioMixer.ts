import { useRef, useCallback } from "react";

export const useAudioMixer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const screenSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const screenGainRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const mixStreams = useCallback(
    (micStream: MediaStream, screenStream: MediaStream): MediaStreamTrack | null => {
      try {
        // 1. Create or resume AudioContext
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;

        // Resume context if suspended (browser security autoplays block)
        if (ctx.state === "suspended") {
          ctx.resume();
        }

        // 2. Create destination
        destinationRef.current = ctx.createMediaStreamDestination();

        // 3. Setup Microphone Node
        const micTrack = micStream.getAudioTracks()[0];
        if (micTrack) {
          const micOnlyStream = new MediaStream([micTrack]);
          micSourceRef.current = ctx.createMediaStreamSource(micOnlyStream);
          micGainRef.current = ctx.createGain();
          micGainRef.current.gain.value = 1.0; // Default volume: 100%
          
          micSourceRef.current
            .connect(micGainRef.current)
            .connect(destinationRef.current);
        }

        // 4. Setup Screen share Audio Node
        const screenAudioTrack = screenStream.getAudioTracks()[0];
        if (screenAudioTrack) {
          const screenOnlyStream = new MediaStream([screenAudioTrack]);
          screenSourceRef.current = ctx.createMediaStreamSource(screenOnlyStream);
          screenGainRef.current = ctx.createGain();
          screenGainRef.current.gain.value = 0.6; // Default screen audio: 60% (so commentary is louder)

          screenSourceRef.current
            .connect(screenGainRef.current)
            .connect(destinationRef.current);
        }

        // 5. Return composite track
        const mixedTrack = destinationRef.current.stream.getAudioTracks()[0];
        return mixedTrack || null;
      } catch (error) {
        console.error("Failed to mix audio streams via Web Audio API:", error);
        return null;
      }
    },
    []
  );

  const setMicVolume = useCallback((volume: number) => {
    if (micGainRef.current) {
      // Clamp volume between 0 and 1.5 (allow boost)
      const clamped = Math.max(0, Math.min(volume, 1.5));
      micGainRef.current.gain.setValueAtTime(clamped, audioContextRef.current?.currentTime || 0);
    }
  }, []);

  const setScreenVolume = useCallback((volume: number) => {
    if (screenGainRef.current) {
      // Clamp volume between 0 and 1.5
      const clamped = Math.max(0, Math.min(volume, 1.5));
      screenGainRef.current.gain.setValueAtTime(clamped, audioContextRef.current?.currentTime || 0);
    }
  }, []);

  const stopMixing = useCallback(() => {
    // Disconnect all nodes
    try {
      micSourceRef.current?.disconnect();
      screenSourceRef.current?.disconnect();
      micGainRef.current?.disconnect();
      screenGainRef.current?.disconnect();
    } catch (e) {
      // Ignored if already disconnected
    }

    micSourceRef.current = null;
    screenSourceRef.current = null;
    micGainRef.current = null;
    screenGainRef.current = null;
    destinationRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
  }, []);

  return {
    mixStreams,
    setMicVolume,
    setScreenVolume,
    stopMixing,
  };
};
