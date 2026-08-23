import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dvdholic.holic',
  appName: 'Touraz Holic',
  webDir: 'build',
  server: {
    url: 'https://touraz-dvdholic-2194adc70fa6.herokuapp.com',
    cleartext: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    Browser: {
      presentationStyle: 'popover'
    },
    App: {
      launchShowDuration: 0
    }
  },
  ios: {
    scheme: 'dvdholic'
  },
  android: {
    buildOptions: {
      signingType: 'apksigner',
    },
  }
};

export default config;
