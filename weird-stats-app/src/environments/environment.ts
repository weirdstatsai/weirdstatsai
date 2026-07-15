// Firebase project: weirdstats-ai
// Authentication → Sign-in method: enable Google, Facebook, and Phone providers.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
  firebaseConfig: {
    apiKey: 'AIzaSyA13uLXDzYLHZxP0I-9N-T7m1sFuzIIGiE',
    authDomain: 'weirdstats-ai.firebaseapp.com',
    projectId: 'weirdstats-ai',
    storageBucket: 'weirdstats-ai.firebasestorage.app',
    messagingSenderId: '636419392315',
    appId: '1:636419392315:web:2c13c88eeff8ad2218ed1e',
    measurementId: 'G-TL5FZD25Z6',
  },
  // Analytics IDs. Trackers only load in production AND after consent
  // (AnalyticsService). Any tracker whose id is empty / still 'REPLACE_…' is
  // skipped — so GA4 works now, Clarity + Hotjar activate once their ids are set.
  analytics: {
    gaId: 'G-TL5FZD25Z6',            // reuses Firebase's GA4 property
    clarityId: 'REPLACE_WITH_CLARITY_ID',
    hotjarId: 'REPLACE_WITH_HOTJAR_ID',
  },
};
