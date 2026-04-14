/**
 * EventBus — Simple pub/sub for decoupled communication between modules.
 * Follows the Open/Closed principle: modules can react to events without
 * modifying the emitter.
 */
export class EventBus {
  #listeners = new Map();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event, callback) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  /** Unsubscribe a specific callback from an event. */
  off(event, callback) {
    const cbs = this.#listeners.get(event);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx > -1) cbs.splice(idx, 1);
    }
  }

  /** Emit an event with optional data payload. */
  emit(event, data = null) {
    const cbs = this.#listeners.get(event) ?? [];
    cbs.forEach(cb => cb(data));
  }
}
