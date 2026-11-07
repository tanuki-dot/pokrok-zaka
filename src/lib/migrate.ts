import type { Assessment, AuditEntry, DB, Level, Summary, SummarySection } from './types'
import { LEVELS } from './levels'
import { uid } from './util'

/*
 * Převod uložených dat mezi verzemi.
 *
 * Verze 1 (do 0.0.4-alpha): škála 1 = nejvyšší zvládnutí, 5 = nejnižší; rozvrh, zvonění,
 * číslo hodiny, kritérium úspěchu, sebehodnocení jako volné texty.
 * Verze 2: škála 1 = nejnižší, 5 = nejvyšší (pokrok_oprava.docx). Rozvrh a hodina
 * odstraněny, kritérium úspěchu odstraněno. Starší sebehodnocení zůstávají (legacy).
 *
 * Převod úrovní: nová = 6 − stará. Významy sedí:
 *   stará 1 „samostatně a umí vysvětlit“   → nová 5 „samostatně a jistě“
 *   stará 2 „s drobnou pomocí“             → nová 4 „samostatně“
 *   stará 3 „základní postup s pomocí“     → nová 3 „s občasnou pomocí“
 *   stará 4 „potřebuje výraznou pomoc“     → nová 2 „s výraznou pomocí“
 *   stará 5 „zatím nezvládá“               → nová 1 „zatím nezvládá“
 */

const flip = (l: number) => (6 - l) as Level

/** Texty úrovní, které generátor souhrnů ve verzi 1 vkládal do vět (malými písmeny). */
const OLD_LEVEL_TEXT = [
  'zvládá samostatně a umí vysvětlit.',
  'zvládá s drobnou pomocí.',
  'zvládá základní postup s pomocí.',
  'potřebuje výraznou pomoc.',
  'zatím nezvládá, potřebuje další podporu.',
]

/**
 * Přepočítá čísla úrovní ve větě, kterou vytvořil generátor souhrnů ve verzi 1.
 * Mění jen známé vzory (posloupnosti „4 → 3 → 2“, „z úrovně X na Y“, „úroveň X oproti Y“,
 * popisy úrovní), takže data ani jiná čísla se nezmění.
 */
export function convertSentenceV1(text: string): string {
  let t = text
  t = t.replace(/([1-5])((?:\s*→\s*[1-5])+)/g, (m) => m.replace(/[1-5]/g, (d) => String(flip(+d))))
  t = t.replace(/z úrovně ([1-5])( \([^)]*\))? na ([1-5])/g, (_m, a, mid = '', b) => `z úrovně ${flip(+a)}${mid} na ${flip(+b)}`)
  t = t.replace(/úroveň ([1-5]) oproti ([1-5])/g, (_m, a, b) => `úroveň ${flip(+a)} oproti ${flip(+b)}`)
  t = t.replace('Samostatně nebo s drobnou pomocí zvládá:', 'Samostatně zvládá:')
  OLD_LEVEL_TEXT.forEach((old, i) => {
    if (t.endsWith(old)) t = t.slice(0, -old.length) + LEVELS[flip(i + 1) - 1].name.toLowerCase() + '.'
  })
  return t
}

function convertSections(sections: SummarySection[]): SummarySection[] {
  return sections.map((sec) => ({
    ...sec,
    // Věty bez zdroje doplnil učitel – ty se nemění.
    sentences: sec.sentences.map((s) => (s.sources.length ? { ...s, text: convertSentenceV1(s.text) } : s)),
  }))
}

type AnyDB = Record<string, unknown> & { version?: number }

export function migrate(raw: AnyDB): DB | null {
  if (!raw || !Array.isArray(raw.assessments)) return null
  if (raw.version === 2) return raw as unknown as DB
  if (raw.version !== 1) return null

  const old = raw as unknown as Omit<DB, 'version'> & { timetable?: unknown; settings: DB['settings'] & { bells?: unknown } }
  const assessments: Assessment[] = old.assessments.map((a) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { lesson: _l, successCriterion: _s, ...rest } = a as Assessment & { lesson?: unknown; successCriterion?: unknown }
    const scores = Object.fromEntries(Object.entries(rest.scores).map(([k, v]) => [k, flip(v)])) as Record<string, Level>
    return { ...rest, scores, skills: Object.keys(scores) }
  })
  const summaries: Summary[] = old.summaries.map((s) => ({
    ...s,
    sections: convertSections(s.sections),
    history: s.history?.map((h) => ({ ...h, sections: convertSections(h.sections) })),
  }))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bells: _b, ...settings } = old.settings
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { timetable: _t, ...rest } = old
  const note: AuditEntry = {
    id: uid('a'),
    at: new Date().toISOString(),
    action: 'převedeno',
    entity: 'škála',
    label: `${assessments.length} hodnocení na škálu 1 (nejnižší) – 5 (nejvyšší)`,
  }
  return { ...rest, version: 2, assessments, summaries, settings, audit: [note, ...old.audit].slice(0, 400) }
}
