// Firebase project: weirdstats-ai (production)
export const environment = {
  production: true,
  // Hosted FastAPI backend on Google Cloud Run (weirdstats-ai project).
  apiUrl: 'https://weirdstats-api-636419392315.us-central1.run.app',
  firebaseConfig: {
    apiKey: 'AIzaSyA13uLXDzYLHZxP0I-9N-T7m1sFuzIIGiE',
    authDomain: 'weirdstats-ai.firebaseapp.com',
    projectId: 'weirdstats-ai',
    storageBucket: 'weirdstats-ai.firebasestorage.app',
    messagingSenderId: '636419392315',
    appId: '1:636419392315:web:2c13c88eeff8ad2218ed1e',
    measurementId: 'G-TL5FZD25Z6',
  },
  // Analytics IDs. Trackers load only in production AND after consent. Any id
  // left as 'REPLACE_…' is skipped — GA4 works now; set the other two to enable.
  analytics: {
    gaId: 'G-TL5FZD25Z6',            // reuses Firebase's GA4 property
    clarityId: 'REPLACE_WITH_CLARITY_ID',
    hotjarId: 'REPLACE_WITH_HOTJAR_ID',
  },
};
