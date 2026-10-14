import type { RunState } from '../types';

// Single authoritative run state. Phaser and DOM both read `store.state`; only rules functions mutate it.
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export const store = {
  state: null as unknown as RunState,
  on(event: string, fn: Listener): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return () => listeners.get(event)!.delete(fn);
  },
  emit(event: string): void {
    listeners.get(event)?.forEach((fn) => fn());
  },
  /** Notify every UI view that state changed. */
  changed(): void {
    this.emit('change');
  },
};
