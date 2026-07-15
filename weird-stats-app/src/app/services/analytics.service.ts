import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    clarity: any;
    hj: any;
    _hjSettings: any;
  }
}

/**
 * Loads Google Analytics 4, Microsoft Clarity, and Hotjar.
 *
 * Guarded on two fronts: scripts are injected only in production, and only
 * after the visitor grants consent (init() is called by AppComponent once
 * consent is 'granted'). Any tracker whose configured id is empty or still the
 * 'REPLACE_…' placeholder is skipped, so GA4 can ship before the Clarity/Hotjar
 * ids exist. init()/loaders are idempotent.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private started = false;
  private gaReady = false;

  /** Inject the trackers. No-op in dev, or if already started. */
  init(): void {
    if (this.started) return;
    if (!environment.production) return; // never load in dev
    this.started = true;

    const cfg = (environment as any).analytics ?? {};
    if (this.valid(cfg.gaId)) this.loadGa(cfg.gaId);
    if (this.valid(cfg.clarityId)) this.loadClarity(cfg.clarityId);
    if (this.valid(cfg.hotjarId)) this.loadHotjar(cfg.hotjarId);
  }

  /**
   * Send a custom GA4 event. Safe to call anytime — no-ops until analytics is
   * initialised (i.e. production + consent granted), so nothing fires in dev or
   * for visitors who declined.
   */
  track(name: string, params: Record<string, any> = {}): void {
    if (this.gaReady && window.gtag) {
      window.gtag('event', name, params);
    }
  }

  /** Record an SPA navigation. Safe to call before init() (no-ops). */
  trackPage(url: string): void {
    if (this.gaReady && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: url,
        page_location: window.location.origin + url,
        page_title: document.title,
      });
    }
    if (window.hj) {
      try {
        window.hj('stateChange', url);
      } catch {
        /* hj not ready yet */
      }
    }
    // Clarity auto-captures SPA route changes — nothing to do.
  }

  private valid(id: any): boolean {
    return typeof id === 'string' && id.length > 0 && !id.startsWith('REPLACE_');
  }

  private inject(src: string): void {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }

  private loadGa(id: string): void {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    } as any;
    window.gtag('js', new Date());
    // send_page_view:false — this is an SPA, we emit page_view per navigation.
    window.gtag('config', id, { send_page_view: false });
    this.inject(`https://www.googletagmanager.com/gtag/js?id=${id}`);
    this.gaReady = true;
    this.trackPage(window.location.pathname + window.location.search);
  }

  private loadClarity(id: string): void {
    (function (c: any, l: any, a: any, r: any, i: any) {
      c[a] = c[a] || function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
      const t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      const y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', id);
  }

  private loadHotjar(id: string): void {
    (function (h: any, o: any, t: any, j: any) {
      h.hj = h.hj || function () {
        (h.hj.q = h.hj.q || []).push(arguments);
      };
      h._hjSettings = { hjid: Number(id), hjsv: 6 };
      const a = o.getElementsByTagName('head')[0];
      const r = o.createElement('script');
      r.async = 1;
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      a.appendChild(r);
    })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=');
  }
}
