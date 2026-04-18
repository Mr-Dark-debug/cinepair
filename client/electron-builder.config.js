/**
 * @fileoverview electron-builder configuration for CinePair.
 * Produces NSIS installer (Windows), DMG (macOS), and AppImage (Linux).
 * Compatible with electron-builder 26.8.2+.
 * @see https://www.electron.build/configuration
 */

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'com.cinepair.app',
  productName: 'CinePair',
  copyright: 'Copyright © 2026 CinePair',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',

  // ─── Directories ──────────────────────────────────────
  directories: {
    output: 'release/${version}',
    buildResources: 'build',
  },

  // ─── Files to include in the package ──────────────────
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'public/**/*',
  ],

  // ─── Extra Resources (accessible at runtime) ─────────
  extraResources: [
    {
      from: 'public',
      to: 'public',
      filter: ['**/*'],
    },
  ],

  // ─── Auto-Update (GitHub Releases provider) ───────────
  publish: [
    {
      provider: 'github',
      owner: 'your-github-username',
      repo: 'cinepair',
      releaseType: 'release',
    },
  ],

  // ═══════════════════════════════════════════════════════
  // WINDOWS – NSIS Installer
  // ═══════════════════════════════════════════════════════
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'public/icon.png',
    legalTrademarks: 'CinePair',
    verifyUpdateCodeSignature: false,
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    menuCategory: 'CinePair',
    shortcutName: 'CinePair',
    uninstallDisplayName: 'CinePair',
    license: '../LICENSE',
    deleteAppDataOnUninstall: true,
    displayLanguageSelector: false,
    warningsAsErrors: false,
    installerIcon: 'public/icon.png',
    uninstallerIcon: 'public/icon.png',
    installerHeaderIcon: 'public/icon.png',
    runAfterFinish: true,
  },

  // ═══════════════════════════════════════════════════════
  // macOS – DMG + Signed & Notarized
  // ═══════════════════════════════════════════════════════
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['universal'],
      },
    ],
    icon: 'public/icon.png',
    category: 'public.app-category.social-networking',
    darkModeSupport: true,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'entitlements.mac.plist',
    entitlementsInherit: 'entitlements.mac.plist',
    extendInfo: {
      NSCameraUsageDescription:
        'CinePair needs camera access for video calls with your partner.',
      NSMicrophoneUsageDescription:
        'CinePair needs microphone access for audio calls with your partner.',
      NSAudioCaptureUsageDescription:
        'CinePair needs audio capture to share system audio during screen sharing.',
      NSScreenCaptureUsageDescription:
        'CinePair needs screen recording access to share your screen.',
    },
  },

  dmg: {
    contents: [
      {
        x: 130,
        y: 220,
        type: 'file',
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications',
      },
    ],
    window: {
      width: 540,
      height: 380,
    },
    title: 'Install CinePair',
  },

  // ═══════════════════════════════════════════════════════
  // Linux – AppImage + deb
  // ═══════════════════════════════════════════════════════
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
    ],
    icon: 'public/icon.png',
    category: 'Network',
    synopsis: 'Private movie co-watching for couples',
    description:
      'CinePair – Watch together, anywhere. A private desktop app for couples to watch movies together with screen sharing, video calls, and chat.',
    desktop: {
      entry: {
        Name: 'CinePair',
        Comment: 'Watch movies together privately',
        Categories: 'Network;VideoConference;Chat',
        Keywords: 'movie;watch;together;couple;screen-share',
      },
    },
  },
};

module.exports = config;
