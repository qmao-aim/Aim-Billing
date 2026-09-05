/**
 * The app can be hosted at a domain root (https://host/) or under a subpath as
 * an IIS virtual application (https://host/appname/) — this derives the real
 * base path once at load time so API calls and the login redirect work either
 * way, without relying on browser relative-URL resolution (which breaks if the
 * address bar ever lacks a trailing slash).
 *
 * Safe to compute once: this is a HashRouter, so `location.pathname` never
 * changes during in-app navigation — only the `#...` fragment does.
 */
export const BASE_PATH = window.location.pathname.replace(/\/?$/, '/')

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path.replace(/^\//, '')}`
}
