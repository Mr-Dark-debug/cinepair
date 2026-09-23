# CinePair product map

## Core room journey

1. **Enter:** open the web or desktop app, set a nickname, create or join a six-character room. Invalid codes and disconnected signaling show an error. Guest mode requires no account.
2. **Protect:** the host can set a passcode, capacity, and approval lobby. Waiting guests cannot send media signaling, chat, or reactions until admitted. The host can admit, deny, kick, mute, transfer host, and change room settings.
3. **Connect:** admitted participants negotiate camera, microphone, and screen-share streams over WebRTC. The server sends STUN settings and, when configured, short-lived TURN credentials. The UI reports connection failures and retry attempts.
4. **Watch:** the room can synchronize public embeddable YouTube videos or direct HTTPS video files. Source changes reset playback position. Queue operations report success or failure. Protected providers open separately and may block capture.
5. **Interact:** room chat supports replies, emoji reactions, screenshots, partner nudges, and shared drawing. A passcode room encrypts chat media with a key derived in the client. Send failures preserve drafts and display errors. Camera-off users get a pixel avatar; supported video elements offer picture-in-picture.
6. **Leave:** a participant can leave, cancel a waiting request, or be removed by the host. The client clears room state and tracks. When the last admitted participant leaves, the room and its waiting guests are removed from signaling memory.

## Accounts and preferences

- Registration, login, session restoration, logout, password change, pairing, and unpairing use the Python account API. Sessions and pairing codes expire. Hosted persistence requires `DATABASE_URL` to a durable PostgreSQL database.
- Nickname, avatar palette, theme, media device choices, update checks, and local UI preferences are managed in settings. Dialogs support keyboard focus and Escape.
- Account identity is separate from guest room membership; people can watch as guests without registering.

## Supported media boundaries

| Source | In-app synchronization | Practical limit |
| --- | --- | --- |
| Public embeddable YouTube | Yes | Creator embed permissions and autoplay policy may block playback. |
| Direct HTTPS MP4/WebM/Ogg | Yes | Browser codec, CORS, and source availability matter. |
| Vimeo, Dailymotion, Twitch | Open externally | CinePair does not control the external player. |
| Netflix, Prime Video, JioHotstar, Disney+, Hulu, Max | Open externally | DRM can block capture; each viewer may need their own subscription. |

## Verified and outstanding gates

- Automated: frontend crypto/UI tests, backend room/auth/storage tests, PostgreSQL account tests in GitHub CI, TypeScript, and production bundle.
- Local browser: two participants joined a passcode room, exchanged encrypted chat, and received a synchronized watch source. A disallowed YouTube embed displayed an error.
- GitHub: Pages publishes the built web client; v0.1.7 Windows, macOS, and Linux installer jobs passed. The release is published with the Render outage disclosed.
- Hosted signaling: currently blocked because Render suspended the free service after its workspace exhausted free usage. A scheduled health request cannot override the quota or guarantee no sleep.
- Hosted accounts: `DATABASE_URL` is not confirmed on the existing Render service. Render Free local SQLite is ephemeral.
- Device-dependent: camera/microphone permissions, screen audio, real cross-network WebRTC with TURN, PiP, and installed-app updater behavior need tests on actual target devices.

The live app cannot be declared fully operational until the hosted signaling, persistent database, and device-dependent gates are verified. See [deployment](DEPLOYMENT_GUIDE.md).
