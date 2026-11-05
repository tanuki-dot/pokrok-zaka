import { useDB } from './store'
import { resolveSelection, useSelectionRaw } from './selection'

/** Data + aktuální výběr třídy a předmětu. */
export function useCtx() {
  const db = useDB()
  const sel = useSelectionRaw()
  return { db, ...resolveSelection(db, sel) }
}
