import type { Bell, DB, TimetableEntry } from './types'

/*
 * Rozvrh a zvonění. Čisté funkce bez vazby na úložiště.
 * Aktuální hodina se počítá ze zvonění, takže funguje i bez vyplněného rozvrhu.
 */

export const DAYS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek']
export const DAYS_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá']

export const DEFAULT_BELLS: Bell[] = [
  { period: 1, start: '08:00', end: '08:45' },
  { period: 2, start: '08:55', end: '09:40' },
  { period: 3, start: '10:00', end: '10:45' },
  { period: 4, start: '10:55', end: '11:40' },
  { period: 5, start: '11:50', end: '12:35' },
  { period: 6, start: '12:45', end: '13:30' },
  { period: 7, start: '13:40', end: '14:25' },
  { period: 8, start: '14:35', end: '15:20' },
]

/** Ukázkový rozvrh pro demo učitelku (sedí ke dnům, kdy jsou v demu záznamy). */
export function demoTimetable(): TimetableEntry[] {
  // Učebny jsou fiktivní: 312 a 314 počítačové učebny, ostatní kmenové třídy.
  const room: Record<string, string> = {
    'p-me1-inf': '312',
    'p-me1-mat': '207',
    'p-7a-mat': '105',
    'p-7a-cj': '108',
  }
  const e = (day: number, period: number, classId: string, subjectId: string, r?: string): TimetableEntry => ({
    id: `r-${day}-${period}`,
    day,
    period,
    classId,
    subjectId,
    room: r ?? room[subjectId],
  })
  return [
    e(0, 2, 'c-7a', 'p-7a-cj'),
    e(0, 4, 'c-me1', 'p-me1-inf'),
    e(1, 2, 'c-me1', 'p-me1-inf'),
    e(1, 3, 'c-me1', 'p-me1-inf'),
    e(1, 5, 'c-7a', 'p-7a-cj'),
    e(2, 1, 'c-7a', 'p-7a-mat'),
    e(2, 3, 'c-7a', 'p-7a-mat'),
    e(3, 2, 'c-me1', 'p-me1-mat'),
    e(3, 4, 'c-7a', 'p-7a-cj'),
    e(3, 6, 'c-me1', 'p-me1-inf', '314'),
    e(4, 1, 'c-7a', 'p-7a-mat'),
    e(4, 3, 'c-me1', 'p-me1-inf'),
  ]
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 0 = pondělí … 6 = neděle */
export const dayIndex = (d: Date) => (d.getDay() + 6) % 7

export const bellLabel = (b: Bell) => `${b.period}. hodina · ${b.start}–${b.end}`

export type LessonStatus = 'probiha' | 'brzy' | 'skoncila'

export interface CurrentLesson {
  day: number
  bell: Bell
  status: LessonStatus
  entry?: TimetableEntry
  /** Klíč hodiny pro „automaticky vybráno jen jednou“. */
  slot: string
}

/** Okno, ve kterém se hodina bere jako aktuální: 10 min před začátkem až 15 min po konci. */
const BEFORE = 10
const AFTER = 15

export function lessonAt(db: Pick<DB, 'timetable' | 'settings'>, now: Date): CurrentLesson | null {
  const day = dayIndex(now)
  if (day > 4) return null
  const t = now.getHours() * 60 + now.getMinutes()
  const bells = [...db.settings.bells].sort((a, b) => toMin(a.start) - toMin(b.start))
  // Přednost má hodina, která právě probíhá; jinak nejbližší v okně.
  let best: { bell: Bell; status: LessonStatus; dist: number } | null = null
  for (const bell of bells) {
    const s = toMin(bell.start)
    const e = toMin(bell.end)
    let status: LessonStatus | null = null
    let dist = 0
    if (t >= s && t <= e) status = 'probiha'
    else if (t < s && s - t <= BEFORE) { status = 'brzy'; dist = s - t }
    else if (t > e && t - e <= AFTER) { status = 'skoncila'; dist = t - e }
    if (!status) continue
    if (status === 'probiha') { best = { bell, status, dist: -1 }; break }
    if (!best || dist < best.dist) best = { bell, status, dist }
  }
  if (!best) return null
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  return {
    day,
    bell: best.bell,
    status: best.status,
    entry: db.timetable.find((x) => x.day === day && x.period === best!.bell.period),
    slot: `${date}|${best.bell.period}`,
  }
}

export const STATUS_LABEL: Record<LessonStatus, string> = {
  probiha: 'Teď',
  brzy: 'Za chvíli',
  skoncila: 'Právě skončila',
}

export function todaysLessons(db: Pick<DB, 'timetable' | 'settings'>, now: Date) {
  const day = dayIndex(now)
  return db.timetable
    .filter((x) => x.day === day)
    .sort((a, b) => a.period - b.period)
    .map((entry) => ({ entry, bell: db.settings.bells.find((b) => b.period === entry.period) }))
}
