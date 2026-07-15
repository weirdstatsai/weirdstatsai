import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConsentStatus = 'granted' | 'denied' | 'unset';

const STORAGE_KEY = 'ws_consent';

/**
 * Persists the visitor's analytics-cookie choice. Trackers (GA4/Clarity/Hotjar)
 * are only initialised once status is 'granted' — see AnalyticsService.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly _status$ = new BehaviorSubject<ConsentStatus>(this.read());
  readonly status$ = this._status$.asObservable();

  status(): ConsentStatus {
    return this._status$.value;
  }

  grant(): void {
    this.write('granted');
  }

  deny(): void {
    this.write('denied');
  }

  private read(): ConsentStatus {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'granted' || v === 'denied' ? v : 'unset';
    } catch {
      return 'unset';
    }
  }

  private write(v: 'granted' | 'denied'): void {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* storage unavailable — keep the in-memory value */
    }
    this._status$.next(v);
  }
}
