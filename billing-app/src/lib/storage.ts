/* Preference storage that cannot take the app down.
 *
 * `localStorage` is not always available: a sandboxed iframe without
 * same-origin access, Safari in private mode, and some locked-down enterprise
 * browser policies all throw on access rather than returning null. Remembering
 * a table preference is never worth a blank page, so every call is guarded and
 * falls back to an in-memory map for the session.
 */

const memory = new Map<string, string>()

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    memory.set(key, value)
  }
}
