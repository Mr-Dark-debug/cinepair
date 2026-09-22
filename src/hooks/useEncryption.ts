// WebCrypto AES-GCM end-to-end encryption helpers for room chat.
// The chat key is derived from the room passcode via PBKDF2. If the room has no
// passcode, encryption is unavailable and chat falls back to TLS-only (plaintext).

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function deriveChatKey(
  roomCode: string,
  passcode: string
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = enc.encode("cinepair:" + roomCode);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(
  key: CryptoKey,
  plaintext: string
): Promise<{ iv: string; ciphertext: string }> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  return { iv: toBase64(iv.buffer), ciphertext: toBase64(cipher) };
}

export async function decryptText(
  key: CryptoKey,
  ivB64: string,
  cipherB64: string
): Promise<string> {
  const iv = fromBase64(ivB64);
  const cipher = fromBase64(cipherB64);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
