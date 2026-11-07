// Datový model podle zadání (docx „Pokrok žáka – SWOT a formativní hodnocení“
// a úprav v „pokrok_oprava.docx“ a „dotaznik.docx“).
// Stejné tabulky jsou v supabase/migrations/0001_init.sql pro ostrý provoz.

export type SchoolType = 'ZS' | 'SS'
/** Úroveň zvládnutí: 1 = nejnižší (zatím nezvládá), 5 = nejvyšší (samostatně a jistě). */
export type Level = 1 | 2 | 3 | 4 | 5
export type SummaryKind = 'tyden' | 'mesic' | 'pololeti'
export type GoalStatus = 'rozpracovany' | 'splneny' | 'nesplneny'
/** Splnění vzdělávacího cíle hodiny (hodnotí učitel). */
export type LessonGoalStatus = 'splneno' | 'castecne' | 'nesplneno'
export type Role = 'ucitel' | 'vedeni'
/** Formulace dotazníku pro žáky: standardní, nebo jednodušší pro mladší žáky. */
export type SelfWording = 'standard' | 'mladsi'

export interface School {
  id: string
  name: string
  type: SchoolType
}

export interface SchoolClass {
  id: string
  schoolId: string
  name: string
  /** Formulace sebehodnoticího dotazníku pro tuto třídu. */
  selfWording?: SelfWording
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

/** Slovní zpětná vazba učitele – nepovinná. */
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
  /** Doporučení pro další rozvoj žáka. */
  rec?: string
  /** Zda text vznikl automaticky a učitel ho ještě neupravil (pak se průběžně přepočítává). */
  proposed: boolean
}

export interface Assessment {
  id: string
  studentId: string
  subjectId: string
  date: string // YYYY-MM-DD
  topic: string
  /** Vzdělávací cíl hodiny. */
  goal: string
  /** Splnění vzdělávacího cíle (null = neoznačeno). */
  goalStatus?: LessonGoalStatus | null
  /** Dovednosti vybrané pro tuto hodinu. Vybraná bez úrovně = nehodnoceno. */
  skills?: string[]
  scores: Record<string, Level>
  feedback: Feedback
  swot: Swot
  /** Formativní hodnocení žáka (krátký text z hodnocení, sebehodnocení a zpětné vazby). */
  formative?: string
  /** true = formativní hodnocení vytvořila aplikace a učitel ho zatím neupravil. */
  formativeProposed?: boolean
  nextGoal: string
  /** Kód pro sebehodnocení žáka (QR / odkaz). Platí do selfCodeExpires, po odeslání zanikne. */
  selfCode: string | null
  selfCodeExpires?: string | null
  /** Kód vydaný učitelem pro opravu už odeslaných odpovědí. */
  selfCodeCorrection?: boolean
  createdAt: string
  updatedAt: string
}

/** Odpovědi v univerzálním dotazníku (dotaznik.docx). */
export interface SelfAnswers {
  /** 1. Porozumění učivu: 3 = rozumím a dokážu použít, 2 = většině rozumím, 1 = zatím moc nerozumím. */
  understanding: 1 | 2 | 3
  /** 2. Práce: 3 = samostatně, 2 = občas pomoc, 1 = častější pomoc. */
  work: 1 | 2 | 3
  /** 3. Co se povedlo (více možností). */
  wentWell: string[]
  /** 4. Co zlepšit (více možností; „nic“ se nekombinuje). */
  improve: string[]
  /** 5. Splnění cíle hodiny podle žáka. */
  goalMet: 'ano' | 'castecne' | 'zatimne'
  /** 6. Co bych chtěl/a příště zvládnout lépe (nepovinné). */
  nextWish: string
}

export interface SelfAssessment {
  id: string
  assessmentId: string
  /** Odpovědi z nového dotazníku. Starší záznamy mají jen volné texty níže. */
  answers?: SelfAnswers
  /** Starší podoba (do verze 0.0.4): volné odpovědi. Zachovává se kvůli historii. */
  learned?: string
  wentWell?: string
  struggle?: string
  needHelp?: string
  nextWant?: string
  submittedAt: string
  /** Kolikrát žák odpovědi opravil (řízená oprava přes nový kód). */
  corrections?: number
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
  action: 'vytvořeno' | 'upraveno' | 'smazáno' | 'schváleno' | 'importováno' | 'odevzdáno' | 'převedeno'
  entity: string
  label: string
}

export interface DB {
  /** 2 = škála 1 (nejnižší) – 5 (nejvyšší); verze 1 měla škálu obráceně. */
  version: 2
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
  settings: { role: Role; teacherName: string; schoolType: SchoolType }
}
