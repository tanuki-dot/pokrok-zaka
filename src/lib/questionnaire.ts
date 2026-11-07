import type { SelfAnswers, SelfAssessment, SelfWording } from './types'

/*
 * Univerzální sebehodnoticí dotazník (dotaznik.docx): jeden pro všechny předměty
 * ZŠ i SŠ včetně odborného výcviku. Mění se jen údaje o hodině a cíli.
 * Varianta „mladsi“ používá jednodušší slova pro mladší žáky (volí se u třídy).
 */

export interface Option<V extends string | number = string> {
  value: V
  label: Record<SelfWording, string>
}

export const Q_UNDERSTANDING: Option<1 | 2 | 3>[] = [
  { value: 3, label: { standard: 'Rozumím a dokážu učivo použít.', mladsi: 'Rozumím a umím to použít.' } },
  { value: 2, label: { standard: 'Většině rozumím, něco si potřebuji procvičit.', mladsi: 'Skoro všemu rozumím, něco si ještě procvičím.' } },
  { value: 1, label: { standard: 'Zatím tomu moc nerozumím.', mladsi: 'Zatím tomu moc nerozumím.' } },
]

export const Q_WORK: Option<1 | 2 | 3>[] = [
  { value: 3, label: { standard: 'Pracoval/a jsem samostatně.', mladsi: 'Zvládl/a jsem to sám/sama.' } },
  { value: 2, label: { standard: 'Občas jsem potřeboval/a pomoc.', mladsi: 'Občas mi někdo pomohl.' } },
  { value: 1, label: { standard: 'Potřeboval/a jsem častější pomoc.', mladsi: 'Potřeboval/a jsem hodně pomoci.' } },
]

export const Q_WENT_WELL: Option[] = [
  { value: 'pochopil', label: { standard: 'Pochopil/a jsem nové učivo.', mladsi: 'Pochopil/a jsem nové učivo.' } },
  { value: 'splnil', label: { standard: 'Splnil/a jsem zadaný úkol.', mladsi: 'Udělal/a jsem úkol.' } },
  { value: 'samostatne', label: { standard: 'Pracoval/a jsem samostatně.', mladsi: 'Pracoval/a jsem sám/sama.' } },
  { value: 'spoluprace', label: { standard: 'Dobře jsem spolupracoval/a.', mladsi: 'Dobře jsem pracoval/a s ostatními.' } },
  { value: 'nevzdal', label: { standard: 'Nevzdal/a jsem se při obtížích.', mladsi: 'Nevzdal/a jsem to, i když to bylo těžké.' } },
]

export const IMPROVE_NOTHING = 'nic'
export const Q_IMPROVE: Option[] = [
  { value: 'porozumet', label: { standard: 'Lépe porozumět učivu.', mladsi: 'Lépe pochopit učivo.' } },
  { value: 'procvicovat', label: { standard: 'Více procvičovat.', mladsi: 'Víc si to procvičit.' } },
  { value: 'samostatneji', label: { standard: 'Pracovat samostatněji.', mladsi: 'Víc pracovat sám/sama.' } },
  { value: 'soustredit', label: { standard: 'Lépe se soustředit.', mladsi: 'Víc se soustředit.' } },
  { value: 'spolupracovat', label: { standard: 'Lépe spolupracovat.', mladsi: 'Líp pracovat s ostatními.' } },
  { value: IMPROVE_NOTHING, label: { standard: 'Nic, dnešní cíl jsem zvládl/a.', mladsi: 'Nic, dnes jsem všechno zvládl/a.' } },
]

export const Q_GOAL_MET: Option<SelfAnswers['goalMet']>[] = [
  { value: 'ano', label: { standard: 'Ano.', mladsi: 'Ano.' } },
  { value: 'castecne', label: { standard: 'Částečně.', mladsi: 'Trochu.' } },
  { value: 'zatimne', label: { standard: 'Zatím ne.', mladsi: 'Zatím ne.' } },
]

export const QUESTIONS: Record<'understanding' | 'work' | 'wentWell' | 'improve' | 'goalMet' | 'nextWish', Record<SelfWording, string>> = {
  understanding: { standard: 'Jak jsem porozuměl/a dnešnímu učivu?', mladsi: 'Jak jsem dnes pochopil/a učivo?' },
  work: { standard: 'Jak se mi dnes pracovalo?', mladsi: 'Jak mi dnes šla práce?' },
  wentWell: { standard: 'Co se mi dnes povedlo?', mladsi: 'Co se mi dnes povedlo?' },
  improve: { standard: 'Co potřebuji ještě zlepšit?', mladsi: 'Co bych mohl/a zlepšit?' },
  goalMet: { standard: 'Splnil/a jsem dnešní cíl hodiny?', mladsi: 'Splnil/a jsem dnešní cíl?' },
  nextWish: { standard: 'Co bych chtěl/a příště zvládnout lépe?', mladsi: 'Co chci příště umět líp?' },
}

export const WORDING_LABEL: Record<SelfWording, string> = {
  standard: 'Standardní (2. stupeň ZŠ a SŠ)',
  mladsi: 'Jednodušší (mladší žáci)',
}

const find = <V extends string | number>(opts: Option<V>[], v: V) => opts.find((o) => o.value === v)?.label.standard ?? ''

/** Krátké popisy odpovědí pro učitele (standardní formulace, bez „Pracoval/a jsem“ apod.). */
export const describe = {
  understanding: (v: 1 | 2 | 3) => find(Q_UNDERSTANDING, v),
  work: (v: 1 | 2 | 3) => find(Q_WORK, v),
  goalMet: (v: SelfAnswers['goalMet']) => find(Q_GOAL_MET, v),
  wentWell: (vs: string[]) => vs.map((v) => find(Q_WENT_WELL, v)).filter(Boolean),
  improve: (vs: string[]) => vs.map((v) => find(Q_IMPROVE, v)).filter(Boolean),
}

/** Bez lomítek „/a“ a bez první osoby – pro věty v souhrnech („pochopil/a jsem nové učivo“ → „pochopení nového učiva“). */
export const WENT_WELL_NOUN: Record<string, string> = {
  pochopil: 'pochopení nového učiva',
  splnil: 'splnění zadaného úkolu',
  samostatne: 'samostatná práce',
  spoluprace: 'spolupráce',
  nevzdal: 'vytrvalost při obtížích',
}
export const IMPROVE_NOUN: Record<string, string> = {
  porozumet: 'lépe porozumět učivu',
  procvicovat: 'více procvičovat',
  samostatneji: 'pracovat samostatněji',
  soustredit: 'lépe se soustředit',
  spolupracovat: 'lépe spolupracovat',
}

export const isLegacy = (s: SelfAssessment) => !s.answers

/** Odpověď 1–3 (porozumění / samostatnost) porovnaná s úrovní učitele 1–5. */
export function teacherBand(level?: number): 1 | 2 | 3 | null {
  if (!level) return null
  return level >= 4 ? 3 : level === 3 ? 2 : 1
}
