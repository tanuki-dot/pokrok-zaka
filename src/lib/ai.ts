import type { DB, ReportLength, SelfAssessment, Swot } from './types'
import { allCriteriaFor } from './util'
import { LEVELS } from './levels'
import { describeSelf } from './questionnaire'
import { periodLabel, teacherQuestions } from './periods'
import { fileKind } from './files'
import { accessToken, remoteEnabled, SUPABASE_URL } from './remote'
import { goalSuggestions, missingInfo, proposeDevelopment, reportText, studentAssessments, type DraftLike } from './analysis'

/*
 * Umělá inteligence (pokrokveskole.docx): návrh cílů, slovní formativní hodnocení
 * a individuální rozvoj. AI běží jen na serveru (Supabase Edge Function
 * supabase/functions/ai-navrh), API klíč nikdy není v prohlížeči.
 *
 * Funkci smí volat jen přihlášený učitel (server s VITE_SUPABASE_URL). V demu
 * se použijí šablony z analysis.ts se stejnými pravidly.
 *
 * Do AI se posílají jen pseudonymizované údaje: bez jména, příjmení a třídy žáka.
 */

// Funkce projektu Supabase, volaná s tokenem přihlášeného učitele.
const FN_URL = remoteEnabled ? `${SUPABASE_URL}/functions/v1/ai-navrh` : undefined
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
export const aiAvailable = !!FN_URL

type Task = 'cile' | 'hodnoceni' | 'rozvoj'

async function call<T>(task: Task, context: unknown, length?: ReportLength): Promise<T> {
  const token = await accessToken()
  if (!token) throw new Error('nejste přihlášeni')
  const r = await fetch(FN_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ANON ? { apikey: ANON } : {}), Authorization: `Bearer ${token}` },
    body: JSON.stringify({ task, length, context }),
  })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}) as { error?: string })
    throw new Error(j.error ?? `AI odpověděla chybou ${r.status}`)
  }
  return (await r.json()) as T
}

/** Pseudonymizovaný kontext hodnocení pro AI. */
export function aiContext(d: DB, a: DraftLike, self?: SelfAssessment) {
  const subj = d.subjects.find((s) => s.id === a.subjectId)
  const cls = d.classes.find((c) => c.id === subj?.classId)
  const school = d.schools.find((s) => s.id === cls?.schoolId)
  const crits = allCriteriaFor(d, a.subjectId)
  const crit = (id: string) => crits.find((c) => c.id === id)?.name ?? id
  const qs = teacherQuestions(a.periodType, a.periodFrom, a.periodTo)
  const prev = studentAssessments(d, a.studentId, a.subjectId)
    .filter((x) => x.id !== a.id && x.date <= a.date)
    .slice(-5)
  return {
    skola: school?.type === 'ZS' ? 'základní škola' : 'střední škola',
    rocnik: cls?.grade ?? null,
    obor: cls?.field ?? null,
    predmet: subj?.name ?? '',
    obdobi: periodLabel(a.periodType, a.periodFrom, a.periodTo),
    typObdobi: a.periodType,
    tematickeCelky: a.units.map((id) => d.units.find((u) => u.id === id)?.name).filter(Boolean),
    tema: a.topic,
    vzdelavaciCile: a.goals.map((g) => ({ cil: g.text, splneni: g.status ?? 'neoznačeno' })),
    hodnoceniUcitele: Object.entries(a.scores).map(([id, l]) => ({ dovednost: crit(id), uroven: l, slovne: LEVELS[l - 1].name, komentar: a.skillNotes[id] ?? '' })),
    dotaznikUcitele: qs.map((q) => ({ otazka: q.title, odpovedi: a.teacherQ[q.key]?.choices ?? [], komentar: a.teacherQ[q.key]?.note ?? '' })),
    sebehodnoceniZaka: self?.answers ? describeSelf(self) : null,
    predchoziHodnoceni: prev.map((x) => ({
      datum: x.date,
      obdobi: periodLabel(x.periodType, x.periodFrom, x.periodTo),
      dovednosti: Object.entries(x.scores).map(([id, l]) => ({ dovednost: crit(id), uroven: l })),
      cile: x.goals.map((g) => ({ cil: g.text, splneni: g.status ?? 'neoznačeno' })),
    })),
    dolozenePrace: d.attachments.filter((x) => x.assessmentId === a.id).map((x) => ({ druh: fileKind(x.type, x.name), od: x.owner === 'zak' ? 'žák' : 'učitel' })),
  }
}

export interface Suggested<T> {
  value: T
  source: 'ai' | 'sablona'
  /** Proč se nepoužila AI (není nastavená / chyba). */
  note?: string
}

export async function suggestGoals(d: DB, a: DraftLike): Promise<Suggested<string[]>> {
  const fallback = goalSuggestions(d, a)
  if (!aiAvailable) return { value: fallback, source: 'sablona', note: 'AI zatím není připojena, návrhy jsou z katalogu ŠVP a předchozích záznamů.' }
  try {
    const r = await call<{ goals: string[] }>('cile', aiContext(d, a))
    return { value: r.goals.filter((g) => typeof g === 'string' && g.trim()).slice(0, 6), source: 'ai' }
  } catch (e) {
    return { value: fallback, source: 'sablona', note: `AI není dostupná (${(e as Error).message}), návrhy jsou ze šablon.` }
  }
}

export async function suggestReport(d: DB, a: DraftLike, self: SelfAssessment | undefined, length: ReportLength): Promise<Suggested<{ text: string; missing: string[] }>> {
  const fallback = reportText(d, a, self, length)
  if (!aiAvailable) return { value: fallback, source: 'sablona', note: 'AI zatím není připojena, návrh je vytvořený šablonou z uložených údajů.' }
  try {
    const r = await call<{ text: string; missing: string[] }>('hodnoceni', aiContext(d, a, self), length)
    // Upozornění na chybějící údaje doplní i aplikace sama – nespoléhá jen na AI.
    return { value: { text: r.text, missing: [...new Set([...missingInfo(d, a, self, length), ...(r.missing ?? [])])] }, source: 'ai' }
  } catch (e) {
    return { value: fallback, source: 'sablona', note: `AI není dostupná (${(e as Error).message}), návrh je ze šablony.` }
  }
}

export async function suggestDevelopment(d: DB, a: DraftLike, self?: SelfAssessment): Promise<Suggested<Swot>> {
  const fallback = proposeDevelopment(d, a, self)
  if (!aiAvailable) return { value: fallback, source: 'sablona' }
  try {
    const r = await call<{ s: string; w: string; o: string; t: string }>('rozvoj', aiContext(d, a, self))
    return { value: { s: r.s, w: r.w, o: r.o, t: r.t, proposed: true }, source: 'ai' }
  } catch (e) {
    return { value: fallback, source: 'sablona', note: `AI není dostupná (${(e as Error).message}).` }
  }
}
