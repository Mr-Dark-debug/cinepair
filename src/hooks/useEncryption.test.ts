// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deriveChatKey, deriveRoomCredential, encryptText, decryptText } from "./useEncryption";

describe("protected-room encryption", () => {
  it("allows peers with the room passcode to decrypt but rejects the server credential", async () => {
    const passcode = "a-long-private-room-passphrase";
    const credential = await deriveRoomCredential(passcode);
    expect(credential).not.toContain(passcode);
    const key = await deriveChatKey("ABC123", passcode);
    const payload = await encryptText(key, "Our private movie night");
    expect(await decryptText(await deriveChatKey("ABC123", passcode), payload.iv, payload.ciphertext)).toBe("Our private movie night");
    await expect(decryptText(await deriveChatKey("ABC123", credential), payload.iv, payload.ciphertext)).rejects.toThrow();
    await expect(decryptText(await deriveChatKey("OTHER1", passcode), payload.iv, payload.ciphertext)).rejects.toThrow();
  });

  it("uses a new nonce for every message and detects modified ciphertext", async () => {
    const key = await deriveChatKey("ABC123", "a-long-private-room-passphrase");
    const first = await encryptText(key, "same message");
    const second = await encryptText(key, "same message");
    expect(first.iv).not.toEqual(second.iv);
    const altered = atob(first.ciphertext);
    const tampered = btoa(String.fromCharCode(altered.charCodeAt(0) ^ 1) + altered.slice(1));
    await expect(decryptText(key, first.iv, tampered)).rejects.toThrow();
  });
});
