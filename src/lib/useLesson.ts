import { useEffect, useState } from 'react'
import type { DB, TimetableEntry } from './types'
import { lessonAt, type CurrentLesson } from './timetable'
import { setSchoolType } from './store'
import { setSelection } from './selection'

const APPLIED_KEY = 'pokrok-zaka:hodina'

/** Aktuální čas, obnovovaný každých 30 s. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Přepne horní výběr (typ školy, třída, předmět) na hodinu z rozvrhu. */
export function selectLesson(db: DB, entry: Pick<TimetableEntry, 'classId' | 'subjectId'>) {
  const cls = db.classes.find((c) => c.id === entry.classId)
  const type = db.schools.find((s) => s.id === cls?.schoolId)?.type
  if (type && type !== db.settings.schoolType) setSchoolType(type)
  setSelection({ classId: entry.classId, subjectId: entry.subjectId })
}

/**
 * Aktuální hodina podle zvonění a rozvrhu. Pokud má hodina v rozvrhu třídu a předmět,
 * vybere je automaticky – ale jen jednou za hodinu, aby nepřebila ruční výběr učitele.
 */
export function useCurrentLesson(db: DB, auto: boolean): CurrentLesson | null {
  const now = useNow()
  const lesson = lessonAt(db, now)
  const valid =
    lesson?.entry &&
    db.classes.some((c) => c.id === lesson.entry!.classId) &&
    db.subjects.some((p) => p.id === lesson.entry!.subjectId)

  useEffect(() => {
    if (!auto || !lesson || !valid) return
    let applied: string | null = null
    try {
      applied = localStorage.getItem(APPLIED_KEY)
    } catch {
      /* bez úložiště se vybere při každém načtení */
    }
    if (applied === lesson.slot) return
    selectLesson(db, lesson.entry!)
    try {
      localStorage.setItem(APPLIED_KEY, lesson.slot)
    } catch {
      /* jen pohodlí */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, lesson?.slot, valid])

  return lesson
}
