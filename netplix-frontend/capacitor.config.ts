import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dvdholic.holic',
  appName: 'Touraz Holic',
  webDir: 'build',
  server: {
    url: 'https://touraz-dvdholic-2194adc70fa6.herokuapp.com',
    cleartext: false,
    // 외부 사이트(구석구석 등)가 WKWebView 를 점유하면 뒤로가기가 앱으로 돌아오지 않는다.
    allowNavigation: ['touraz-dvdholic-2194adc70fa6.herokuapp.com'],
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
