// Datový model podle zadání (formativní hodnocení.docx, pokrok_oprava.docx, dotaznik.docx
// a pokrokveskole.docx). Stejné tabulky jsou v supabase/migrations pro ostrý provoz.

export type SchoolType = 'ZS' | 'SS'
/** Úroveň zvládnutí: 1 = výborně (nejlepší), 5 = zatím nezvládá (nejnižší). */
export type Level = 1 | 2 | 3 | 4 | 5
export type PeriodType = 'hodina' | 'tyden' | 'mesic' | 'pololeti' | 'rok' | 'vlastni'
export type SummaryKind = 'tyden' | 'mesic' | 'pololeti' | 'rok' | 'vlastni'
export type GoalStatus = 'rozpracovany' | 'splneny' | 'nesplneny'
/** Splnění vzdělávacího cíle (hodnotí učitel). */
export type LessonGoalStatus = 'splneno' | 'castecne' | 'nesplneno'
export type Role = 'ucitel' | 'vedeni'
/** Formulace sebehodnoticího dotazníku: standardní, nebo jednodušší pro mladší žáky. */
export type SelfWording = 'standard' | 'mladsi'
export type ReportLength = 'kratke' | 'stredni' | 'dlouhe'

export interface School {
  id: string
  name: string
  type: SchoolType
}

export interface SchoolClass {
  id: string
  schoolId: string
  name: string
  /** Ročník (pro výběr tematických celků ŠVP). */
  grade?: number
  /** Obor (SŠ). */
  field?: string
  selfWording?: SelfWording
}

export interface Student {
  id: string
  classId: string
  firstName: string
  lastName: string
}

export interface Subject {
  id: string
  classId: string
  name: string
  /** Výchozí dovednosti, které učitel u předmětu vypnul (nejsou pro předmět relevantní). */
  hiddenDefaults: string[]
}

/** Hodnocená dovednost. subjectId = null → společná pro všechny předměty. */
export interface Criterion {
  id: string
  subjectId: string | null
  name: string
  question: string
  /** Starší dovednost – zůstává v historii, pro nová hodnocení se nenabízí. */
  archived?: boolean
}

/** Tematický celek podle ŠVP (ukázkový katalog + vlastní celky učitele). */
export interface TopicUnit {
  id: string
  /** Název předmětu malými písmeny (katalog se páruje podle názvu předmětu). */
  subjectName: string
  /** Ročníky, pro které celek platí (prázdné = všechny). */
  grades: number[]
  /** Typ školy (prázdné = obě). */
  schoolType?: SchoolType
  name: string
  /** Připravené vzdělávací cíle k celku. */
  goals: string[]
  custom?: boolean
}

export interface Feedback {
  good: string
  todo: string
  next: string
}

/** Individuální rozvoj žáka (dříve SWOT). */
export interface Swot {
  /** Co žák zvládá (zelené pole). */
  s: string
  /** Co potřebuje zlepšit (oranžové pole). */
  w: string
  /** Možnosti dalšího rozvoje (modré pole). */
  o: string
  /** Překážky v učení (červené pole). */
  t: string
  rec?: string
  /** Text vytvořila aplikace a učitel ho zatím neupravil (pak se průběžně přepočítává). */
  proposed: boolean
}

export interface AssessmentGoal {
  id: string
  text: string
  status: LessonGoalStatus | null
}

export type TeacherQKey = 'zvladnuti' | 'samostatnost' | 'povedlo' | 'procvicit' | 'dalsi'
export interface TeacherAnswer {
  choices: string[]
  note: string
}

export interface Report {
  length: ReportLength
  text: string
  /** Původní (vytvořený) návrh – pro „Vrátit původní návrh“. */
  original: string
  source: 'sablona' | 'ai' | 'ucitel'
  approved: boolean
  approvedAt: string | null
  /** Upozornění na chybějící podklady při vytvoření návrhu. */
  missing: string[]
  /** Přílohy vybrané do výsledné zprávy. */
  attachments: string[]
}

/** Upravený sebehodnoticí dotazník (učitel ho může před zpřístupněním žákovi změnit). */
export interface SelfFormDef {
  period: PeriodType
  rangeLabel?: string
  understanding: { title: string; options: { value: 1 | 2 | 3; label: string }[] }
  work: { title: string; options: { value: 1 | 2 | 3; label: string }[] }
  wentWell: { title: string; options: { id: string; label: string }[] }
  improve: { title: string; options: { id: string; label: string }[]; exclusive?: string }
  goalMet: { title: string }
  nextWish: { title: string }
}

export interface Assessment {
  id: string
  studentId: string
  subjectId: string
  /** Datum hodnocení. */
  date: string // YYYY-MM-DD
  /** Hodnocené období. */
  periodType: PeriodType
  periodFrom: string
  periodTo: string
  /** Tematické celky ŠVP. */
  units: string[]
  /** Vlastní téma výuky. */
  topic: string
  goals: AssessmentGoal[]
  /** Dovednosti vybrané pro toto hodnocení. Vybraná bez úrovně = nehodnoceno. */
  skills: string[]
  scores: Record<string, Level>
  /** Slovní komentář učitele ke každé dovednosti. */
  skillNotes: Record<string, string>
  /** Dotazník učitele podle období. */
  teacherQ: Partial<Record<TeacherQKey, TeacherAnswer>>
  /** Slovní zpětná vazba (odvozená z dotazníku učitele; kvůli souhrnům a exportu). */
  feedback: Feedback
  swot: Swot
  report?: Report
  nextGoal: string
  selfForm?: SelfFormDef
  status: 'rozpracovane' | 'dokoncene'
  selfCode: string | null
  selfCodeExpires?: string | null
  selfCodeCorrection?: boolean
  /** Původní hodnoty a škála u převedených záznamů (nic se nepřepisuje beze stopy). */
  scoresOriginal?: { scale: 'v1' | 'v2'; scores: Record<string, number>; convertedAt: string }
  createdAt: string
  updatedAt: string
}

export interface SelfAnswers {
  /** 1. Porozumění: 3 = nejlepší odpověď, 1 = nejslabší. */
  understanding: 1 | 2 | 3
  /** 2. Práce: 3 = samostatně, 1 = častá pomoc. */
  work: 1 | 2 | 3
  wentWell: string[]
  improve: string[]
  goalMet: 'ano' | 'castecne' | 'zatimne'
  nextWish: string
  /** Vlastní poznámky žáka k otázkám. */
  notes?: Partial<Record<'understanding' | 'work' | 'wentWell' | 'improve' | 'goalMet', string>>
}

export interface SelfAssessment {
  id: string
  assessmentId: string
  answers?: SelfAnswers
  /** Znění dotazníku, na který žák odpovídal (pro správné zobrazení odpovědí). */
  form?: SelfFormDef
  /** Starší podoba (do 0.0.4): volné odpovědi. */
  learned?: string
  wentWell?: string
  struggle?: string
  needHelp?: string
  nextWant?: string
  submittedAt: string
  corrections?: number
}

export interface Attachment {
  id: string
  assessmentId: string
  owner: 'ucitel' | 'zak'
  name: string
  type: string
  size: number
  addedAt: string
}

/** Druh dokumentu: podpůrná opatření žáka (plpp…spc), školní ŠVP/plán (svp, plan), jiné. */
export type DocKind = 'plpp' | 'ivp' | 'ppp' | 'spc' | 'svp' | 'plan' | 'jine'

/** Dokument. Buď podpůrný dokument žáka (scope 'zak', PLPP/IVP/PPP/SPC), nebo školní
 *  dokument (scope 'skola', ŠVP a tematické plány, volitelně vázané na předmět).
 *  Obsah souboru je v úložišti, tady jen popis. */
export interface Document {
  id: string
  scope: 'zak' | 'skola'
  studentId: string | null
  schoolId: string | null
  subjectId: string | null
  kind: DocKind
  name: string
  mime: string
  size: number
  addedAt: string
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
  history?: { version: number; sections: SummarySection[]; teacherNote: string; approvedAt: string | null }[]
  /** Znění vět před převodem škály (zachování původních záznamů). */
  sectionsOriginal?: SummarySection[]
}

export interface Phrase {
  id: string
  kind: keyof Feedback
  text: string
}

export interface AuditEntry {
  id: string
  at: string
  action: 'vytvořeno' | 'upraveno' | 'smazáno' | 'schváleno' | 'importováno' | 'odevzdáno' | 'převedeno'
  entity: string
  label: string
}

export interface DB {
  /** 3 = škála 1 (nejlepší) – 5 (nejnižší), období, více cílů, přílohy. */
  version: 3
  schools: School[]
  classes: SchoolClass[]
  students: Student[]
  subjects: Subject[]
  criteria: Criterion[]
  units: TopicUnit[]
  assessments: Assessment[]
  selfAssessments: SelfAssessment[]
  attachments: Attachment[]
  documents: Document[]
  goals: Goal[]
  summaries: Summary[]
  phrases: Phrase[]
  audit: AuditEntry[]
  settings: { role: Role; teacherName: string; schoolType: SchoolType }
}
