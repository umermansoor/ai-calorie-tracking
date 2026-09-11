/** Serial, cached typeahead: old responses cannot replace the newest query. */
export class Autocomplete<T> {
  private revision = 0;
  private flight: Promise<unknown> | null = null;
  private cache = new Map<string, T[]>();
  constructor(private fetchSuggestions: (query: string) => Promise<T[]>) {}
  cancel() {
    this.revision++;
  }
  async resolve<V>(load: () => Promise<V>): Promise<V | null> {
    const revision = ++this.revision;
    if (this.flight) {
      try {
        await this.flight;
      } catch {}
      if (revision !== this.revision) return null;
    }
    const flight = load();
    this.flight = flight;
    try {
      const value = await flight;
      return revision === this.revision ? value : null;
    } catch (error) {
      if (revision === this.revision) throw error;
      return null;
    } finally {
      if (this.flight === flight) this.flight = null;
    }
  }
  async search(raw: string): Promise<T[] | null> {
    const revision = ++this.revision,
      query = raw.trim().slice(0, 64);
    if ((query.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 2) return [];
    if (this.flight) {
      try {
        await this.flight;
      } catch {}
      if (revision !== this.revision) return null;
    }
    const cached = this.cache.get(query.toLocaleLowerCase());
    if (cached) return cached;
    const flight = this.fetchSuggestions(query);
    this.flight = flight;
    try {
      const items = await flight;
      if (this.cache.size >= 40)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(query.toLocaleLowerCase(), items);
      return revision === this.revision ? items : null;
    } catch (error) {
      if (revision === this.revision) throw error;
      return null;
    } finally {
      if (this.flight === flight) this.flight = null;
    }
  }
}
