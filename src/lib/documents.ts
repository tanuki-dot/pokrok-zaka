import type { DB, DocKind, Document } from './types'

/*
 * Dokumentace a podpůrná opatření žáka (zadání: rozbalovací pole v 1. kroku „Údaje o žákovi").
 * Jeden sdílený číselník pro formulář (StepStudent), detail žáka i propojení s formativním
 * hodnocením (šablony v analysis.ts a kontext pro AI v ai.ts).
 */

/** Druhy dokumentace a podpůrných opatření žáka v pořadí nabídky rozbalovacího pole. */
export const SUPPORT_KINDS: DocKind[] = ['plpp', 'ivp', 'ppp', 'spc', 'spz', 'podpurna', 'upravy', 'jine']

/** Dlouhé popisky do rozbalovacího pole. */
export const SUPPORT_KIND_LABEL: Partial<Record<DocKind, string>> = {
  plpp: 'PLPP – Plán pedagogické podpory',
  ivp: 'IVP – Individuální vzdělávací plán',
  ppp: 'Doporučení PPP – pedagogicko-psychologická poradna',
  spc: 'Doporučení SPC – speciálně pedagogické centrum',
  spz: 'Zpráva ze školského poradenského zařízení (ŠPZ)',
  podpurna: 'Doporučení k podpůrným opatřením',
  upravy: 'Doporučení k úpravě podmínek vzdělávání a hodnocení',
  jine: 'Další dokument',
}

/** Krátké popisky (odznak u souboru, výpis, formativní zpráva). */
export const SUPPORT_KIND_SHORT: Partial<Record<DocKind, string>> = {
  plpp: 'PLPP',
  ivp: 'IVP',
  ppp: 'Doporučení PPP',
  spc: 'Doporučení SPC',
  spz: 'Zpráva ŠPZ',
  podpurna: 'Podpůrná opatření',
  upravy: 'Úprava podmínek',
  jine: 'Další dokument',
}

/** Název opatření pro zobrazení: u „dalšího dokumentu" vlastní název, jinak druh. */
export const docKindLabel = (d: Pick<Document, 'kind' | 'title'>) =>
  d.kind === 'jine' && d.title?.trim() ? d.title.trim() : SUPPORT_KIND_SHORT[d.kind] ?? 'Dokument'

export interface SupportInfo {
  /** Nahrané dokumenty podpůrných opatření žáka. */
  docs: Document[]
  /** Druhy/názvy evidovaných opatření (pro zprávu a AI). */
  labels: string[]
  /** Učitel výslovně označil, že žák nemá evidovaná podpůrná opatření. */
  noSupport: boolean
}

/** Shrnutí dokumentace a podpůrných opatření žáka pro propojení s hodnocením. */
export function supportMeasures(d: DB, studentId: string): SupportInfo {
  const docs = d.documents.filter((x) => x.scope === 'zak' && x.studentId === studentId)
  const labels = [...new Set(docs.map(docKindLabel))]
  const noSupport = !!d.students.find((s) => s.id === studentId)?.noSupport
  return { docs, labels, noSupport }
}

/** Soubory přijímané u podpůrných opatření: PDF nebo Word (zadání). */
export const SUPPORT_ACCEPT = 'application/pdf,.pdf,.doc,.docx,.docm,.dotx,.odt,.rtf'
