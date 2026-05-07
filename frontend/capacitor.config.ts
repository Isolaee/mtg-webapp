import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tcgbuilder.app',
  appName: 'TCG Builder',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  }
};

export default config;
