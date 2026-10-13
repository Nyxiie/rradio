import { useSyncExternalStore } from 'react'

/** Tiny external store with a React hook; avoids a state-management dependency. */
export interface Store<T> {
  get(): T
  set(next: T | ((prev: T) => T)): void
  patch(partial: Partial<T>): void
  subscribe(fn: () => void): () => void
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const subs = new Set<() => void>()
  const set: Store<T>['set'] = (next) => {
    const value = typeof next === 'function' ? (next as (p: T) => T)(state) : next
    if (value === state) return
    state = value
    subs.forEach((fn) => fn())
  }
  return {
    get: () => state,
    set,
    patch: (partial) => set((prev) => ({ ...prev, ...partial })),
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

export function useStore<T, S>(store: Store<T>, selector: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()))
}
