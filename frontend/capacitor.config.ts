import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tcgbuilder.app',
  appName: 'TCG Builder',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    // Dev-only live reload: set CAP_LIVE_RELOAD to your dev server URL before
    // `npx cap sync android` (emulator: http://10.0.2.2:3000, phone: http://<LAN-IP>:3000).
    // Unset in normal/CI builds, so the release AAB always bundles webDir — production-safe.
    ...(process.env.CAP_LIVE_RELOAD && {
      url: process.env.CAP_LIVE_RELOAD,
      cleartext: true,
    }),
  },
};

export default config;
