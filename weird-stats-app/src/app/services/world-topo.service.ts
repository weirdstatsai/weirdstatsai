import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as topojson from 'topojson-client';

export interface CountryFeature { id: number; d: string; }

/**
 * Singleton service — loads world-110m.json exactly once per app session
 * and caches the projected SVG paths. All card-map instances share this cache.
 * O(1) subsequent access after the first load.
 */
@Injectable({ providedIn: 'root' })
export class WorldTopoService {
  private cache: CountryFeature[] | null = null;
  private loading: Promise<CountryFeature[]> | null = null;

  constructor(private http: HttpClient) {}

  async getCountries(
    project: (lon: number, lat: number) => [number, number]
  ): Promise<CountryFeature[]> {
    if (this.cache) return this.cache;
    if (this.loading) return this.loading;

    this.loading = this._load(project);
    this.cache = await this.loading;
    return this.cache;
  }

  private async _load(
    project: (lon: number, lat: number) => [number, number]
  ): Promise<CountryFeature[]> {
    const topo: any = await firstValueFrom(this.http.get('/assets/world-110m.json'));
    const key = Object.keys(topo.objects)[0];
    const geojson: any = topojson.feature(topo, topo.objects['countries'] ?? topo.objects[key]);

    return geojson.features
      .map((f: any) => ({ id: +f.id, d: this._geoToPath(f, project) }))
      .filter((c: CountryFeature) => c.d);
  }

  private _geoToPath(
    feature: any,
    project: (lon: number, lat: number) => [number, number]
  ): string {
    const geom = feature.geometry;
    if (!geom) return '';
    const polys = geom.type === 'Polygon'
      ? [geom.coordinates]
      : geom.type === 'MultiPolygon' ? geom.coordinates : [];

    return polys.map((poly: any[]) =>
      poly.map((ring: number[][]) =>
        ring.map(([lon, lat]: number[], i: number) => {
          const [x, y] = project(lon, lat);
          if (i > 0 && Math.abs(lon - ring[i - 1][0]) > 180)
            return `M${x.toFixed(1)},${y.toFixed(1)}`;
          return (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join('') + 'Z'
      ).join('')
    ).join('');
  }
}
