import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { APP_CONFIG, AppConfig, FeatureFlag, FeatureFlags } from '../config/app-config';

const FLAG_OVERRIDES_KEY = 'weird_stats_feature_flags';

/**
 * App-wide accessor for {@link APP_CONFIG}.
 *
 * - Read metadata: `config.version`, `config.app.name`, `config.build.number`…
 * - Check a feature: `config.isEnabled('projects')`
 * - Flip a feature at runtime: `config.setFlag('projects', false)` /
 *   `config.toggle('projects')` — overrides are persisted to localStorage so
 *   they survive reloads. `resetFlags()` clears them.
 * - React to changes: subscribe to `flags$`.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly _config: AppConfig;
  private readonly _flags$: BehaviorSubject<FeatureFlags>;

  constructor() {
    const overrides = this.loadOverrides();
    this._config = {
      ...APP_CONFIG,
      featureFlags: { ...APP_CONFIG.featureFlags, ...overrides },
    };
    this._flags$ = new BehaviorSubject<FeatureFlags>(this._config.featureFlags);
  }

  /** The full, immutable-by-convention config object. */
  get config(): AppConfig { return this._config; }

  get app() { return this._config.app; }
  get version(): string { return this._config.version; }
  get build() { return this._config.build; }
  get meta() { return this._config.meta; }
  get links() { return this._config.links; }
  get limits() { return this._config.limits; }

  /** "1.0.0 (build 1)" — handy for settings/about screens. */
  get versionLabel(): string {
    return `${this._config.version} (build ${this._config.build.number})`;
  }

  // ── Feature flags ─────────────────────────────────────────────────────────
  get flags(): FeatureFlags { return this._config.featureFlags; }
  get flags$(): Observable<FeatureFlags> { return this._flags$.asObservable(); }

  /** Is a feature turned on? */
  isEnabled(flag: FeatureFlag): boolean {
    return this._config.featureFlags[flag] === true;
  }

  /** Turn a feature on or off (persisted). */
  setFlag(flag: FeatureFlag, value: boolean): void {
    this._config.featureFlags[flag] = value;
    this.persistOverrides();
    this._flags$.next({ ...this._config.featureFlags });
  }

  /** Flip a feature and return its new value. */
  toggle(flag: FeatureFlag): boolean {
    const next = !this.isEnabled(flag);
    this.setFlag(flag, next);
    return next;
  }

  /** Drop all runtime overrides, restoring the defaults from APP_CONFIG. */
  resetFlags(): void {
    localStorage.removeItem(FLAG_OVERRIDES_KEY);
    this._config.featureFlags = { ...APP_CONFIG.featureFlags };
    this._flags$.next({ ...this._config.featureFlags });
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  private loadOverrides(): Partial<FeatureFlags> {
    try {
      const raw = localStorage.getItem(FLAG_OVERRIDES_KEY);
      return raw ? (JSON.parse(raw) as Partial<FeatureFlags>) : {};
    } catch {
      return {};
    }
  }

  private persistOverrides(): void {
    const overrides: Partial<FeatureFlags> = {};
    (Object.keys(this._config.featureFlags) as FeatureFlag[]).forEach(flag => {
      if (this._config.featureFlags[flag] !== APP_CONFIG.featureFlags[flag]) {
        overrides[flag] = this._config.featureFlags[flag];
      }
    });
    localStorage.setItem(FLAG_OVERRIDES_KEY, JSON.stringify(overrides));
  }
}
