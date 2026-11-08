import type { PeriodType, SelfAnswers, SelfAssessment, SelfFormDef, SelfWording } from './types'
import { effectiveType, periodLabel } from './periods'

/*
 * Sebehodnocení žáka podle hodnoceného období (pokrokveskole.docx, snímek 4).
 * Otázky 1, 2, 5: jedna odpověď. 3, 4: více odpovědí. 6: nepovinná vlastní odpověď.
 * Volba „nic nepotřebuji zlepšit“ se nekombinuje s ostatními. Učitel může dotazník
 * před zpřístupněním žákovi upravit (uloží se k hodnocení jako SelfFormDef).
 */

type Base = Omit<SelfFormDef, 'period' | 'rangeLabel'>
const opt3 = (a: string, b: string, c: string) => [
  { value: 3 as const, label: a },
  { value: 2 as const, label: b },
  { value: 1 as const, label: c },
]
const ids = (prefix: string, labels: string[]) => labels.map((label, i) => ({ id: `${prefix}${i + 1}`, label }))

const FORMS: Record<Exclude<PeriodType, 'vlastni'>, Base> = {
  hodina: {
    understanding: { title: 'Jak jsem porozuměl/a dnešnímu učivu?', options: opt3('Rozumím a dokážu učivo použít.', 'Většině rozumím, něco si potřebuji procvičit.', 'Zatím tomu moc nerozumím.') },
    work: { title: 'Jak se mi dnes pracovalo?', options: opt3('Pracoval/a jsem samostatně.', 'Občas jsem potřeboval/a pomoc.', 'Potřeboval/a jsem častější pomoc.') },
    wentWell: { title: 'Co se mi dnes povedlo?', options: [
      { id: 'pochopil', label: 'Pochopil/a jsem nové učivo.' },
      { id: 'splnil', label: 'Splnil/a jsem zadaný úkol.' },
      { id: 'samostatne', label: 'Pracoval/a jsem samostatně.' },
      { id: 'spoluprace', label: 'Dobře jsem spolupracoval/a.' },
      { id: 'nevzdal', label: 'Nevzdal/a jsem se při obtížích.' },
    ] },
    improve: { title: 'Co potřebuji ještě zlepšit?', options: [
      { id: 'porozumet', label: 'Lépe porozumět učivu.' },
      { id: 'procvicovat', label: 'Více procvičovat.' },
      { id: 'samostatneji', label: 'Pracovat samostatněji.' },
      { id: 'soustredit', label: 'Lépe se soustředit.' },
      { id: 'spolupracovat', label: 'Lépe spolupracovat.' },
      { id: 'nic', label: 'Nic, dnešní cíl jsem zvládl/a.' },
    ], exclusive: 'nic' },
    goalMet: { title: 'Podařilo se mi splnit dnešní vzdělávací cíl?' },
    nextWish: { title: 'Co bych chtěl/a příště zvládnout lépe?' },
  },
  tyden: {
    understanding: { title: 'Jak jsem porozuměl/a učivu probíranému tento týden?', options: opt3('Rozumím a dokážu učivo použít.', 'Většině rozumím, něco si potřebuji procvičit.', 'Některému učivu zatím nerozumím.') },
    work: { title: 'Jak se mi tento týden pracovalo?', options: opt3('Pracoval/a jsem většinou samostatně.', 'Občas jsem potřeboval/a pomoc.', 'Často jsem potřeboval/a pomoc.') },
    wentWell: { title: 'Co se mi tento týden povedlo?', options: ids('t-p', ['Porozuměl/a jsem novému učivu.', 'Splnil/a jsem zadané úkoly.', 'Pracoval/a jsem samostatně.', 'Dobře jsem spolupracoval/a.', 'Zlepšil/a jsem se oproti minulému týdnu.']) },
    improve: { title: 'Co potřebuji příští týden zlepšit?', options: [
      ...ids('t-z', ['Lépe porozumět učivu.', 'Více procvičovat.', 'Pracovat samostatněji.', 'Lépe se soustředit.', 'Lépe si organizovat práci.']),
      { id: 't-nic', label: 'Zatím nepotřebuji nic zásadního zlepšit.' },
    ], exclusive: 't-nic' },
    goalMet: { title: 'Podařilo se mi splnit vzdělávací cíle tohoto týdne?' },
    nextWish: { title: 'Na co se chci zaměřit příští týden?' },
  },
  mesic: {
    understanding: { title: 'Jak hodnotím své porozumění učivu za tento měsíc?', options: opt3('Učivu rozumím a dokážu ho použít.', 'Většině učiva rozumím.', 'V některých tématech mám stále obtíže.') },
    work: { title: 'Jak jsem během měsíce pracoval/a?', options: opt3('Většinou samostatně a pravidelně.', 'Občas jsem potřeboval/a pomoc.', 'Často jsem potřeboval/a podporu a vedení.') },
    wentWell: { title: 'Co se mi tento měsíc povedlo?', options: ids('m-p', ['Naučil/a jsem se nové znalosti a dovednosti.', 'Zlepšil/a jsem se v předmětu.', 'Plnil/a jsem zadané úkoly.', 'Pracoval/a jsem samostatněji.', 'Lépe jsem spolupracoval/a.']) },
    improve: { title: 'V čem se potřebuji zlepšit?', options: [
      ...ids('m-z', ['Porozumění některým tématům.', 'Pravidelná příprava.', 'Samostatnost.', 'Soustředění.', 'Organizace práce.']),
      { id: 'm-nic', label: 'Zatím nepotřebuji nic zásadního zlepšit.' },
    ], exclusive: 'm-nic' },
    goalMet: { title: 'Podařilo se mi splnit vzdělávací cíle tohoto měsíce?' },
    nextWish: { title: 'Jaký pokrok bych chtěl/a udělat příští měsíc?' },
  },
  pololeti: {
    understanding: { title: 'Jak hodnotím své znalosti a dovednosti v tomto předmětu za pololetí?', options: opt3('Učivo zvládám a dokážu znalosti použít.', 'Většinu učiva zvládám, některé oblasti potřebuji procvičit.', 'Ve více oblastech potřebuji pomoc.') },
    work: { title: 'Jak jsem během pololetí pracoval/a?', options: opt3('Většinou samostatně a zodpovědně.', 'Občas jsem potřeboval/a pomoc a vedení.', 'Často jsem potřeboval/a podporu učitele.') },
    wentWell: { title: 'Co se mi během pololetí podařilo?', options: ids('p-p', ['Získal/a jsem nové znalosti a dovednosti.', 'Zlepšil/a jsem své výsledky.', 'Naučil/a jsem se pracovat samostatněji.', 'Pravidelně jsem plnil/a úkoly.', 'Zlepšil/a jsem spolupráci a komunikaci.', 'Dokázal/a jsem překonat některé obtíže.']) },
    improve: { title: 'Co potřebuji v dalším pololetí zlepšit?', options: ids('p-z', ['Porozumění učivu.', 'Praktické využití znalostí.', 'Pravidelnou přípravu.', 'Samostatnost.', 'Organizaci práce.', 'Soustředění.']) },
    goalMet: { title: 'Podařilo se mi splnit vzdělávací cíle tohoto pololetí?' },
    nextWish: { title: 'Co bych chtěl/a v dalším pololetí zvládnout lépe?' },
  },
  rok: {
    understanding: { title: 'Jak hodnotím své celkové znalosti a dovednosti v tomto předmětu?', options: opt3('Učivo zvládám samostatně a dokážu ho využívat.', 'Většinu učiva zvládám, ale některé oblasti potřebuji procvičit.', 'V některých oblastech stále potřebuji výraznější pomoc.') },
    work: { title: 'Jak se mi během školního roku dařilo pracovat?', options: opt3('Pracoval/a jsem většinou samostatně a zodpovědně.', 'Občas jsem potřeboval/a pomoc.', 'Často jsem potřeboval/a vedení.') },
    wentWell: { title: 'Jakého pokroku jsem během školního roku dosáhl/a?', options: ids('r-p', ['Získal/a jsem nové znalosti.', 'Naučil/a jsem se nové dovednosti.', 'Zlepšil/a jsem své výsledky.', 'Jsem samostatnější.', 'Lépe spolupracuji.', 'Dokážu lépe řešit problémy.', 'Naučil/a jsem se překonávat obtíže.']) },
    improve: { title: 'Na čem potřebuji v dalším školním roce pracovat?', options: ids('r-z', ['Prohloubit své znalosti.', 'Lépe využívat znalosti v praxi.', 'Pracovat samostatněji.', 'Pravidelně se připravovat.', 'Lépe si organizovat práci.', 'Zlepšit spolupráci a komunikaci.']) },
    goalMet: { title: 'Podařilo se mi splnit vzdělávací cíle školního roku?' },
    nextWish: { title: 'Co považuji za svůj největší úspěch a co bych chtěl/a příští rok zlepšit?' },
  },
}

/** Jednodušší slova pro mladší žáky (dotazník k hodině). */
const YOUNGER: Partial<Base> = {
  understanding: { title: 'Jak jsem dnes pochopil/a učivo?', options: opt3('Rozumím a umím to použít.', 'Skoro všemu rozumím, něco si ještě procvičím.', 'Zatím tomu moc nerozumím.') },
  work: { title: 'Jak mi dnes šla práce?', options: opt3('Zvládl/a jsem to sám/sama.', 'Občas mi někdo pomohl.', 'Potřeboval/a jsem hodně pomoci.') },
  goalMet: { title: 'Splnil/a jsem dnešní cíl?' },
  nextWish: { title: 'Co chci příště umět líp?' },
}

/** Úprava formulací pro vlastní období. */
const customize = (t: string) =>
  t
    .replace(/dnešnímu učivu|učivu probíranému tento týden/, 'učivu v tomto období')
    .replace(/tento týden|tento měsíc|za tento měsíc|během měsíce|během pololetí|za pololetí|během školního roku/g, 'v tomto období')
    .replace(/dnes/g, 'v tomto období')
    .replace(/příští týden|příští měsíc|v dalším pololetí|příští rok|v dalším školním roce/g, 'v dalším období')
    .replace(/dnešní vzdělávací cíl|vzdělávací cíle tohoto týdne|vzdělávací cíle tohoto měsíce|vzdělávací cíle tohoto pololetí|vzdělávací cíle školního roku/, 'vzdělávací cíle tohoto období')
    .replace(/oproti minulému týdnu/, 'oproti předchozímu období')

export function selfFormFor(type: PeriodType, from: string, to: string, wording: SelfWording = 'standard'): SelfFormDef {
  const eff = effectiveType(type, from, to)
  let base: Base = structuredClone(FORMS[eff])
  if (eff === 'hodina' && wording === 'mladsi' && type === 'hodina') base = { ...base, ...structuredClone(YOUNGER) }
  if (type === 'vlastni') {
    const fix = <T extends { title: string; options?: { label: string }[] }>(q: T): T => ({
      ...q,
      title: customize(q.title),
      ...(q.options ? { options: q.options.map((o) => ({ ...o, label: customize(o.label) })) } : {}),
    })
    base = {
      understanding: fix(base.understanding),
      work: fix(base.work),
      wentWell: fix(base.wentWell),
      improve: fix(base.improve),
      goalMet: fix(base.goalMet),
      nextWish: fix(base.nextWish),
    }
  }
  return { period: type, rangeLabel: periodLabel(type, from, to), ...base }
}

export const WORDING_LABEL: Record<SelfWording, string> = {
  standard: 'Standardní (2. stupeň ZŠ a SŠ)',
  mladsi: 'Jednodušší (mladší žáci, dotazník k hodině)',
}

export const GOAL_MET_LABEL: Record<SelfAnswers['goalMet'], string> = { ano: 'Ano', castecne: 'Částečně', zatimne: 'Zatím ne' }

/** Starší sebehodnocení (do 0.0.5) neměla uložené znění – použije se dotazník k hodině. */
const LEGACY_FORM = (): SelfFormDef => ({ period: 'hodina', ...structuredClone(FORMS.hodina) })

export const formOf = (s: SelfAssessment): SelfFormDef => s.form ?? LEGACY_FORM()

/** Popisy odpovědí pro učitele, souhrny a export. */
export function describeSelf(s: SelfAssessment) {
  const f = formOf(s)
  const a = s.answers!
  const lab = (list: { id: string; label: string }[], idsList: string[]) => idsList.map((i) => list.find((o) => o.id === i)?.label ?? i)
  return {
    understanding: f.understanding.options.find((o) => o.value === a.understanding)?.label ?? '',
    work: f.work.options.find((o) => o.value === a.work)?.label ?? '',
    wentWell: lab(f.wentWell.options, a.wentWell),
    improve: lab(f.improve.options, a.improve),
    nothingToImprove: !!f.improve.exclusive && a.improve.includes(f.improve.exclusive),
    goalMet: GOAL_MET_LABEL[a.goalMet],
    nextWish: a.nextWish,
    notes: a.notes ?? {},
  }
}

export const isLegacy = (s: SelfAssessment) => !s.answers

/** Úroveň učitele 1–5 převedená na tři stupně dotazníku (3 = nejlepší). */
export function teacherBand(level?: number): 1 | 2 | 3 | null {
  if (!level) return null
  return level <= 2 ? 3 : level === 3 ? 2 : 1
}
