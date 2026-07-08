import { environment } from '../../environments/environment';

/**
 * Global application config.
 *
 * Single source of truth for project metadata, versioning and feature flags.
 * Read it anywhere via `AppConfigService` (which also lets you toggle flags at
 * runtime). Do not mutate `APP_CONFIG` directly — go through the service so
 * overrides are tracked and persisted.
 */

// ── Feature flags ───────────────────────────────────────────────────────────
// Add a key here to introduce a new toggleable feature. Anything gated on a
// flag should default to OFF unless it's ready for everyone.
export interface FeatureFlags {
  /** Projects tab inside the profile (create projects, bulk PDF import). */
  projects: boolean;
  /** Bulk PDF import + future analysis agent (lives under Projects). */
  pdfBulkImport: boolean;
  /** Single-stat "Add" flow inside a project. */
  projectSingleAdd: boolean;
  /** Private (paid) saves. */
  privateSaves: boolean;
  /** Share-to-social from the card detail page. */
  socialSharing: boolean;
  /** Admin panel entry + routes. */
  adminPanel: boolean;
}

export type FeatureFlag = keyof FeatureFlags;

export interface AppConfig {
  app: {
    name: string;
    shortName: string;
    description: string;
    tagline: string;
  };
  version: string;
  build: {
    number: number;
    date: string;        // ISO date the build config was cut
    channel: 'dev' | 'beta' | 'production';
    environment: 'development' | 'production';
  };
  meta: {
    author: string;
    website: string;
    supportEmail: string;
    copyrightYear: number;
    firebaseProjectId: string;
  };
  links: {
    terms: string;
    privacy: string;
    help: string;
  };
  limits: {
    freeSavedCards: number;
    maxProjectNameLength: number;
    maxBulkPdfSizeMb: number;
    maxStatsPerProject: number;
  };
  featureFlags: FeatureFlags;
}

export const APP_CONFIG: AppConfig = {
  app: {
    name: 'WeirdStats.ai',
    shortName: 'WeirdStats',
    description: 'Generate and share the world\'s weirdest AI-powered stat cards.',
    tagline: 'Collecting the world\'s weirdest stats 📊',
  },

  version: '1.0.0',
  build: {
    number: 1,
    date: '2026-07-05',
    channel: environment.production ? 'production' : 'dev',
    environment: environment.production ? 'production' : 'development',
  },

  meta: {
    author: 'WeirdStats',
    website: 'https://weirdstats.ai',
    supportEmail: 'support@weirdstats.ai',
    copyrightYear: 2026,
    firebaseProjectId: environment.firebaseConfig.projectId,
  },

  links: {
    terms: 'https://weirdstats.ai/terms',
    privacy: 'https://weirdstats.ai/privacy',
    help: 'https://weirdstats.ai/help',
  },

  limits: {
    freeSavedCards: 10,
    maxProjectNameLength: 60,
    maxBulkPdfSizeMb: 20,
    maxStatsPerProject: 30,
  },

  // ── Toggle features here ──────────────────────────────────────────────────
  featureFlags: {
    projects: true,
    pdfBulkImport: true,
    projectSingleAdd: false,
    privateSaves: true,
    socialSharing: true,
    adminPanel: true,
  },
};
