/**
 * DataLoader — Single Responsibility: fetches and caches JSON data.
 * All data access goes through this module to centralize error handling and caching.
 */
export class DataLoader {
  #cache = new Map();

  async #fetch(url) {
    if (this.#cache.has(url)) return this.#cache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status} ${res.statusText}`);
    const data = await res.json();
    this.#cache.set(url, data);
    return data;
  }

  /** Loads the course manifest (sections list, unlock config). */
  async loadCourse() {
    return this.#fetch('data/course.json');
  }

  /** Loads a section's question bank by its data file path. */
  async loadSection(dataFile) {
    return this.#fetch(dataFile);
  }

  /** Clears the internal cache (useful for hot-reloading during development). */
  clearCache() {
    this.#cache.clear();
  }
}
