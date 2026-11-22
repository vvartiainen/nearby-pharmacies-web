import type { Position } from "./geometry.ts";

/** Sorted unique node IDs with coordinates filled in pass 3. */
export class NodeStore {
  ids: Float64Array = new Float64Array(0);
  lat: Int32Array = new Int32Array(0);
  lon: Int32Array = new Int32Array(0);
  found: Uint8Array = new Uint8Array(0);
  #pending: number[] = [];

  add(id: number) {
    this.#pending.push(id);
  }

  freeze() {
    const sorted = Float64Array.from(this.#pending).toSorted();
    let count = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i] !== sorted[i - 1]) sorted[count++] = sorted[i] ?? 0;
    }
    this.ids = sorted.slice(0, count);
    this.lat = new Int32Array(count);
    this.lon = new Int32Array(count);
    this.found = new Uint8Array(count);
    this.#pending = [];
  }

  indexOf(id: number): number {
    let low = 0;
    let high = this.ids.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const value = this.ids[mid] ?? 0;
      if (value === id) return mid;
      if (value < id) low = mid + 1;
      else high = mid - 1;
    }
    return -1;
  }

  /** Coordinates in units of 1e-7 degrees, OSM's storage precision. */
  set(index: number, latNano: number, lonNano: number) {
    this.lat[index] = Math.round(latNano / 100);
    this.lon[index] = Math.round(lonNano / 100);
    this.found[index] = 1;
  }

  position(id: number): Position | undefined {
    const index = this.indexOf(id);
    if (index < 0 || !this.found[index]) return undefined;
    return [(this.lon[index] ?? 0) / 1e7, (this.lat[index] ?? 0) / 1e7];
  }
}
