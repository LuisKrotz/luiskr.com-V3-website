/**
 * @file shared-observer.ts
 * @description Shared IntersectionObserver pool for media figures. A media
 * page mounts ~100 figures and each used to create up to three private
 * IntersectionObserver instances (visibility, lazy-load, CDN warm) — ~500
 * observer instances whose per-frame `computeIntersections` passes ate the
 * scroll frame budget (measured: disabling IO lifted /portfolio/melissa
 * from ~24fps to ~67fps under 4x CPU). One pooled instance per
 * options-signature collapses the storm to a handful of instances while
 * per-element handlers keep every figure's behavior identical.
 */

/** Per-element entry handler — receives the entry for its own target. */
export type SharedObserverHandler = (entry: IntersectionObserverEntry) => void

/**
 * Handle returned by observeShared — mirrors the disconnect() surface the
 * figure fields used when they held raw IntersectionObserver instances.
 * `callback` exposes the pool's entry dispatch so tests can inject entries
 * the same way happy-dom observers expose `.callback`.
 */
export interface SharedObserverHandle {
  /** Stops observing the element and drops its handler from the pool. */
  disconnect(): void

  /** Routes raw entries through the pool's per-target dispatch (test surface). */
  callback(entries: IntersectionObserverEntry[]): void
}

/** One pooled IntersectionObserver + the element→handler routing table. */
interface SharedObserverPool {
  io: IntersectionObserver
  ioClass: typeof IntersectionObserver
  handlers: Map<Element, SharedObserverHandler>
  callback: (entries: IntersectionObserverEntry[]) => void
}

/** Options-signature → pool. Instances never change options after construction. */
const pools = new Map<string, SharedObserverPool>()

/**
 * Serializes observer options into a pool key — same signature means the
 * instances are interchangeable and one real IntersectionObserver can
 * serve every element.
 * @param opts The IntersectionObserverInit the caller would have used.
 * @returns Stable string key for the options signature.
 */
const poolKey = (opts: IntersectionObserverInit): string =>
  `${opts.rootMargin ?? ''}|${opts.threshold ?? 0}`

/**
 * Observes `el` through the pooled IntersectionObserver for `opts`,
 * invoking `handler` with each entry whose target is `el`. Returns a
 * handle whose disconnect() unobserves just this element — the pool and
 * its other observed targets stay alive.
 * @param el The element to observe.
 * @param handler Per-element entry callback.
 * @param opts Options signature selecting the pool.
 * @returns Handle with a disconnect() matching IntersectionObserver's.
 */
export const observeShared = (
  el: Element,
  handler: SharedObserverHandler,
  opts: IntersectionObserverInit
): SharedObserverHandle => {
  const key = poolKey(opts)

  let pool = pools.get(key)

  // Test isolation: suites stub globalThis.IntersectionObserver per test
  // to capture constructor callbacks — a pool built on the previous class
  // must be discarded so the next observe() hits the stubbed ctor.
  if (pool && pool.ioClass !== IntersectionObserver) {
    pools.delete(key)
    pool = undefined
  }

  if (!pool) {
    const handlers = new Map<Element, SharedObserverHandler>()

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const direct = handlers.get(entry.target)

        // Entries injected without a target (happy-dom stubs, test
        // fixtures) can't route by element — when exactly one handler is
        // registered there is no ambiguity, so deliver to it.
        if (direct) {
          direct(entry)

          return
        }

        if (handlers.size === 1) handlers.forEach((h) => h(entry))
      })
    }

    const io = new IntersectionObserver(callback, opts)

    pool = { io, ioClass: IntersectionObserver, handlers, callback }

    pools.set(key, pool)
  }

  pool.handlers.set(el, handler)
  pool.io.observe(el)

  return {
    disconnect: () => {
      pool.handlers.delete(el)
      pool.io.unobserve(el)
    },
    callback: (entries) => entries.forEach((entry) => handler(entry)),
  }
}
