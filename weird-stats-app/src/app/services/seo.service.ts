import { Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title?: string;
  description?: string;
  /** Absolute or root-relative path for canonical + og:url. */
  url?: string;
  /** Absolute image URL for og:image / twitter:image. */
  image?: string;
  type?: 'website' | 'article';
}

const SITE = 'WeirdStats.ai';
const ORIGIN = 'https://weirdstats.ai';
const DEFAULTS: Required<SeoData> = {
  title: `${SITE} — Ask something weird, get a chart worth sharing`,
  description:
    'Turn any curious question into surprising stats, rankings, and visual insights in seconds. WeirdStats.ai makes charts worth sharing.',
  url: ORIGIN + '/',
  image: ORIGIN + '/assets/og/og-default.png',
  type: 'website',
};

/**
 * Keeps document <title> and social/meta tags in sync as the SPA navigates.
 *
 * NOTE: This runs client-side, so it only benefits JS-capable crawlers
 * (Googlebot). Social scrapers (WhatsApp/Facebook/X/LinkedIn) and Bing read the
 * static HTML and never execute this — per-card previews for those are served
 * by the backend bot-snapshot route. See index.html for the static defaults.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(private title: Title, private meta: Meta) {}

  update(data: SeoData): void {
    const d = { ...DEFAULTS, ...this.clean(data) };
    const url = this.absolute(d.url);

    this.title.setTitle(d.title);
    this.setName('description', d.description);
    this.setCanonical(url);

    this.setProp('og:type', d.type);
    this.setProp('og:site_name', SITE);
    this.setProp('og:title', d.title);
    this.setProp('og:description', d.description);
    this.setProp('og:url', url);
    this.setProp('og:image', d.image);

    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', d.title);
    this.setName('twitter:description', d.description);
    this.setName('twitter:image', d.image);
  }

  reset(): void {
    this.update(DEFAULTS);
  }

  /** Drop undefined/empty keys so DEFAULTS win for anything not provided. */
  private clean(data: SeoData): SeoData {
    const out: SeoData = {};
    (Object.keys(data) as (keyof SeoData)[]).forEach(k => {
      const v = data[k];
      if (v != null && v !== '') (out as Record<string, unknown>)[k] = v;
    });
    return out;
  }

  private absolute(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return ORIGIN + (path.startsWith('/') ? path : '/' + path);
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProp(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private setCanonical(href: string): void {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
