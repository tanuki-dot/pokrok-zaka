// Datový model podle zadání (docx „Pokrok žáka – SWOT a formativní hodnocení“).
// Stejné tabulky jsou v supabase/migrations/0001_init.sql pro ostrý provoz.

export type SchoolType = 'ZS' | 'SS'
export type Level = 1 | 2 | 3 | 4 | 5
export type SummaryKind = 'tyden' | 'mesic' | 'pololeti'
export type GoalStatus = 'rozpracovany' | 'splneny' | 'nesplneny'
export type Role = 'ucitel' | 'vedeni'

export interface School {
  id: string
  name: string
  type: SchoolType
}

export interface SchoolClass {
  id: string
  schoolId: string
  name: string
}

export interface Student {
  id: string
  classId: string
  firstName: string
  lastName: string
}

/** Předmět vyučovaný v konkrétní třídě. */
export interface Subject {
  id: string
  classId: string
  name: string
  /** Výchozí oblasti, které učitel u tohoto předmětu vypnul. */
  hiddenDefaults: string[]
}

/** Hodnoticí kritérium. subjectId = null → výchozí oblast pro všechny předměty. */
export interface Criterion {
  id: string
  subjectId: string | null
  name: string
  question: string
}

export interface Feedback {
  good: string
  todo: string
  next: string
}

export interface Swot {
  s: string
  w: string
  o: string
  t: string
  /** Zda text vznikl jako návrh aplikace a učitel ho ještě neupravil. */
  proposed: boolean
}

export interface Assessment {
  id: string
  studentId: string
  subjectId: string
  date: string // YYYY-MM-DD
  topic: string
  goal: string
  successCriterion: string
  scores: Record<string, Level>
  feedback: Feedback
  swot: Swot
  nextGoal: string
  /** Číslo vyučovací hodiny (podle zvonění), pokud je známé. */
  lesson?: number | null
  /** Jednorázový kód pro sebehodnocení žáka (QR / odkaz). */
  selfCode: string | null
  createdAt: string
  updatedAt: string
}

export interface SelfAssessment {
  id: string
  assessmentId: string
  learned: string
  wentWell: string
  struggle: string
  needHelp: string
  nextWant: string
  submittedAt: string
}

export interface Goal {
  id: string
  studentId: string
  subjectId: string
  text: string
  setOn: string
  due: string
  status: GoalStatus
  assessmentId: string | null
}

export interface SummarySentence {
  id: string
  text: string
  /** ID záznamů (hodnocení / cílů / sebehodnocení), ze kterých věta vznikla. Prázdné = doplnil učitel. */
  sources: string[]
}

export interface SummarySection {
  key: string
  title: string
  sentences: SummarySentence[]
}

export interface Summary {
  id: string
  studentId: string
  subjectId: string
  kind: SummaryKind
  from: string
  to: string
  sections: SummarySection[]
  teacherNote: string
  status: 'navrh' | 'schvaleno'
  version: number
  createdAt: string
  approvedAt: string | null
  /** Dříve schválené verze (při úpravě schváleného souhrnu vzniká nová verze). */
  history?: { version: number; sections: SummarySection[]; teacherNote: string; approvedAt: string | null }[]
}

export interface Phrase {
  id: string
  kind: keyof Feedback
  text: string
}

export interface AuditEntry {
  id: string
  at: string
  action: 'vytvořeno' | 'upraveno' | 'smazáno' | 'schváleno' | 'importováno' | 'odevzdáno'
  entity: string
  label: string
}

/** Zvonění: jedna vyučovací hodina a její čas (HH:MM). */
export interface Bell {
  period: number
  start: string
  end: string
}

/** Položka rozvrhu: den (0 = pondělí … 4 = pátek), hodina, třída a předmět. */
export interface TimetableEntry {
  id: string
  day: number
  period: number
  classId: string
  subjectId: string
  /** Číslo učebny (nepovinné). */
  room?: string
}

export interface DB {
  version: 1
  schools: School[]
  classes: SchoolClass[]
  students: Student[]
  subjects: Subject[]
  criteria: Criterion[]
  assessments: Assessment[]
  selfAssessments: SelfAssessment[]
  goals: Goal[]
  summaries: Summary[]
  phrases: Phrase[]
  audit: AuditEntry[]
  timetable: TimetableEntry[]
  settings: { role: Role; teacherName: string; schoolType: SchoolType; bells: Bell[] }
}
