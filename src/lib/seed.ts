import type {
  Assessment, AuditEntry, Criterion, DB, Goal, Level, LessonGoalStatus, Phrase, SchoolClass, SelfAssessment, Student, Subject, Summary, TeacherQKey, TeacherAnswer,
} from './types'
import { addDays, periodFor, today, weekStart } from './dates'
import { generateSummary, proposeDevelopment, reportText } from './analysis'
import { uid } from './util'
import { DEFAULT_CRITERIA, DEMO_UNITS } from './catalog'
import { selfFormFor } from './questionnaire'
import { rangeFor } from './periods'

export { DEFAULT_CRITERIA } from './catalog'

/** Tematický celek ŠVP podle tématu ukázkové hodiny. */
const UNIT_OF: Record<string, string> = {
  'Zlomky – krácení a rozšiřování': 'svp-mat-7-1',
  'Sčítání a odčítání zlomků': 'svp-mat-7-1',
  'Násobení a dělení zlomků': 'svp-mat-7-1',
  'Slovní úlohy se zlomky': 'svp-mat-7-1',
  'Desetinná čísla': 'svp-mat-7-2',
}

/*
 * Demo režim: fiktivní školy, třídy a žáci (ZŠ i SŠ), aby šlo formativní hodnocení
 * vyzkoušet bez skutečných osobních údajů. Data se generují relativně k dnešku
 * (posledních 9 týdnů), takže týdenní přehled je vždy naplněný.
 */

const PHRASES: Omit<Phrase, 'id'>[] = [
  { kind: 'good', text: 'Pracuje soustředěně a dokončí zadání.' },
  { kind: 'good', text: 'Správně používá nový postup.' },
  { kind: 'good', text: 'Umí vysvětlit, proč postup funguje.' },
  { kind: 'good', text: 'Ochotně pomáhá ve dvojici.' },
  { kind: 'todo', text: 'Potřebuje pomoc při zahájení samostatné práce.' },
  { kind: 'todo', text: 'Chybuje v zápisu, vyplatí se kontrolovat výsledek.' },
  { kind: 'todo', text: 'Zatím nedokončí úlohu v daném čase.' },
  { kind: 'next', text: 'Samostatně vyřešit jednu podobnou úlohu a zkontrolovat výsledek.' },
  { kind: 'next', text: 'Vysvětlit postup spolužákovi vlastními slovy.' },
  { kind: 'next', text: 'Procvičit postup na třech krátkých úlohách.' },
]

type Fb = { good: string[]; todo: string[]; next: string[]; goal: string }

const INFO_TOPICS: [string, Fb][] = [
  ['Úvod do tabulkového procesoru', {
    goal: 'Žák se orientuje v prostředí tabulkového procesoru a zapíše data do buněk.',
    good: ['Rychlá orientace v prostředí a správně uložený soubor.', 'Data zapsaná do správných buněk.', 'Správně pojmenovaný list.'],
    todo: ['Potřebuje pomoc s označováním oblastí buněk.', 'Plete si řádky a sloupce při zápisu.', 'Zatím neuloží soubor do správné složky.'],
    next: ['Samostatně založit nový sešit a zapsat tabulku známek.', 'Procvičit označování oblastí myší i klávesnicí.'],
  }],
  ['Formátování tabulky', {
    goal: 'Žák naformátuje tabulku tak, aby byla přehledná.',
    good: ['Přehledná tabulka se záhlavím a ohraničením.', 'Správně nastavený formát měny.', 'Samostatně sloučené buňky záhlaví.'],
    todo: ['Potřebuje pomoc s formátem čísel.', 'Ohraničení zatím nastavuje jen s návodem.'],
    next: ['Samostatně naformátovat tabulku výdajů podle zadání.', 'Nastavit formát procent bez nápovědy.'],
  }],
  ['Vzorce a odkazy', {
    goal: 'Žák zapíše jednoduchý vzorec s odkazy na buňky.',
    good: ['Správně zapsaný vzorec s odkazy na buňky.', 'Vzorec zkopírovaný do dalších řádků bez chyby.'],
    todo: ['Píše do vzorce čísla místo odkazů na buňky.', 'Potřebuje pomoc s kopírováním vzorce.'],
    next: ['Vytvořit vzorec pro součet dvou sloupců a ověřit ho změnou dat.', 'Procvičit kopírování vzorců tažením.'],
  }],
  ['Funkce SUMA a PRŮMĚR', {
    goal: 'Žák vytvoří tabulku a použije funkce SUMA a PRŮMĚR.',
    good: ['Správně vytvořená tabulka a použitá funkce SUMA.', 'Funkce SUMA použitá samostatně a bez chyby.', 'Správně zvolená oblast pro součet.'],
    todo: ['Potřebuje pomoc s funkcí PRŮMĚR.', 'Do oblasti funkce zahrnuje i záhlaví.', 'Zaměňuje funkci SUMA a PRŮMĚR.'],
    next: ['Samostatně vypočítat průměr pěti čísel.', 'Vypočítat průměrnou známku třídy funkcí PRŮMĚR.'],
  }],
  ['Funkce MIN a MAX', {
    goal: 'Žák použije funkce MIN a MAX při vyhodnocení dat.',
    good: ['Správně použité funkce MIN a MAX.', 'Samostatně doplněné vyhodnocení tabulky.'],
    todo: ['Potřebuje pomoc s výběrem správné oblasti dat.', 'Zatím si nepamatuje zápis funkce MAX.'],
    next: ['Vyhodnotit tabulku teplot funkcemi MIN, MAX a PRŮMĚR.', 'Použít MIN a MAX v nové tabulce bez návodu.'],
  }],
  ['Grafy', {
    goal: 'Žák vytvoří z tabulky vhodný graf s popisky.',
    good: ['Zvolený vhodný typ grafu a doplněný název.', 'Správně popsané osy grafu.'],
    todo: ['Potřebuje pomoc s výběrem dat pro graf.', 'Graf zatím nemá popisky os.'],
    next: ['Vytvořit sloupcový graf z tabulky výdajů s popisky.', 'Porovnat dva typy grafů a vybrat vhodnější.'],
  }],
  ['Podmíněné formátování', {
    goal: 'Žák použije podmíněné formátování ke zvýraznění hodnot.',
    good: ['Správně nastavené pravidlo pro zvýraznění.', 'Samostatně upravené pravidlo podle zadání.'],
    todo: ['Potřebuje pomoc s nastavením podmínky.', 'Pravidlo zatím aplikuje na špatnou oblast.'],
    next: ['Zvýraznit podprůměrné hodnoty pomocí pravidla.', 'Nastavit dvě pravidla v jedné tabulce.'],
  }],
  ['Řazení a filtrování dat', {
    goal: 'Žák seřadí a vyfiltruje data podle zadání.',
    good: ['Správně seřazená data podle více sloupců.', 'Samostatně použitý filtr.'],
    todo: ['Při řazení rozdělí řádky, potřebuje kontrolu.', 'Potřebuje pomoc s vlastním filtrem.'],
    next: ['Seřadit seznam podle dvou kritérií a ověřit výsledek.', 'Vyfiltrovat data podle podmínky bez nápovědy.'],
  }],
  ['Práce v Excelu – opakování', {
    goal: 'Žák vytvoří tabulku a použije funkce SUMA, PRŮMĚR, MIN a MAX.',
    good: ['Správně vytvořená tabulka a použité funkce SUMA a PRŮMĚR.', 'Všechny čtyři funkce použité bez chyby.', 'Přehledně naformátované výsledky.'],
    todo: ['Potřebuje pomoc s funkcí PRŮMĚR.', 'Zatím potřebuje kontrolu oblasti u funkce MAX.'],
    next: ['Samostatně vypočítat průměr pěti čísel.', 'Připravit vlastní tabulku a vyhodnotit ji všemi funkcemi.'],
  }],
]

const MATH_TOPICS: [string, Fb][] = [
  ['Zlomky – krácení a rozšiřování', {
    goal: 'Žák krátí a rozšiřuje zlomky.',
    good: ['Správně krácené zlomky na základní tvar.', 'Umí vysvětlit, proč se hodnota zlomku nemění.'],
    todo: ['Potřebuje pomoc s hledáním společného dělitele.', 'Zatím nekrátí až na základní tvar.'],
    next: ['Zkrátit pět zlomků a zkontrolovat výsledek.', 'Vysvětlit krácení spolužákovi.'],
  }],
  ['Sčítání a odčítání zlomků', {
    goal: 'Žák sčítá a odčítá zlomky s různým jmenovatelem.',
    good: ['Správně nalezený společný jmenovatel.', 'Výsledky zkrácené na základní tvar.'],
    todo: ['Sčítá i jmenovatele, potřebuje vrátit k postupu.', 'Potřebuje pomoc s nejmenším společným násobkem.'],
    next: ['Vyřešit tři příklady se zlomky a výsledek ověřit.', 'Procvičit hledání společného jmenovatele.'],
  }],
  ['Násobení a dělení zlomků', {
    goal: 'Žák násobí a dělí zlomky.',
    good: ['Správný postup při násobení zlomků.', 'Dělení převedené na násobení převrácenou hodnotou.'],
    todo: ['Při dělení zapomíná převrátit zlomek.', 'Potřebuje pomoc s krácením před násobením.'],
    next: ['Vyřešit pět příkladů na dělení zlomků.', 'Zkontrolovat výsledky odhadem.'],
  }],
  ['Slovní úlohy se zlomky', {
    goal: 'Žák řeší slovní úlohy se zlomky.',
    good: ['Správně zapsaný postup i odpověď.', 'Úloha vyřešená samostatně.'],
    todo: ['Potřebuje pomoc s převodem textu na výpočet.', 'Chybí odpověď celou větou.'],
    next: ['Vyřešit dvě slovní úlohy a zapsat odpověď.', 'Podtrhnout v zadání důležité údaje.'],
  }],
  ['Desetinná čísla', {
    goal: 'Žák převádí zlomky na desetinná čísla.',
    good: ['Správný převod zlomků na desetinná čísla.', 'Umí porovnat desetinná čísla.'],
    todo: ['Plete si řády desetinných míst.', 'Potřebuje pomoc s dělením při převodu.'],
    next: ['Převést pět zlomků a seřadit výsledky.', 'Procvičit porovnávání desetinných čísel.'],
  }],
]

const ME1 = [
  ['Adam', 'Novák'], ['Bára', 'Dvořáková'], ['Daniel', 'Kříž'], ['Ema', 'Svobodová'],
  ['Filip', 'Horák'], ['Hana', 'Marková'], ['Jakub', 'Veselý'], ['Klára', 'Benešová'],
  ['Matěj', 'Černý'], ['Nela', 'Pokorná'],
]
const SEVEN_A = [
  ['Lukáš', 'Pokorný'], ['Marie', 'Kučerová'], ['Ondřej', 'Fiala'], ['Petra', 'Šimková'],
  ['Tomáš', 'Růžička'], ['Veronika', 'Malá'], ['Vojtěch', 'Sýkora'], ['Zuzana', 'Krejčí'],
]

const NEXT_WISH = ['Udělat tabulku úplně sám/sama.', 'Naučit se grafy.', 'Zvládnout všechny funkce bez pomoci.', 'Počítat zlomky rychleji.', '']

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createDemoDB(): DB {
  const r = rng(20261105)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n))) as Level

  const schools = [
    { id: 'skola-zs', name: 'ZŠ Lipová (demo)', type: 'ZS' as const },
    { id: 'skola-ss', name: 'Střední průmyslová škola (demo)', type: 'SS' as const },
  ]
  const classes: SchoolClass[] = [
    { id: 'c-me1', schoolId: 'skola-ss', name: 'ME1', grade: 1, field: 'Mechanik elektrotechnik' },
    { id: 'c-7a', schoolId: 'skola-zs', name: '7.A', grade: 7 },
  ]
  const students: Student[] = [
    ...ME1.map(([f, l], i) => ({ id: `s-me1-${i}`, classId: 'c-me1', firstName: f, lastName: l })),
    ...SEVEN_A.map(([f, l], i) => ({ id: `s-7a-${i}`, classId: 'c-7a', firstName: f, lastName: l })),
  ]
  const subjects: Subject[] = [
    { id: 'p-me1-inf', classId: 'c-me1', name: 'Informatika', hiddenDefaults: [] },
    { id: 'p-me1-mat', classId: 'c-me1', name: 'Matematika', hiddenDefaults: [] },
    { id: 'p-7a-mat', classId: 'c-7a', name: 'Matematika', hiddenDefaults: ['k-digitalni'] },
    { id: 'p-7a-cj', classId: 'c-7a', name: 'Český jazyk', hiddenDefaults: [] },
  ]
  const criteria: Criterion[] = [
    ...DEFAULT_CRITERIA,
    { id: 'k-inf-suma', subjectId: 'p-me1-inf', name: 'Funkce v tabulce', question: 'Žák vytvoří tabulku a použije funkci SUMA.' },
    { id: 'k-7a-ulohy', subjectId: 'p-7a-mat', name: 'Slovní úlohy', question: 'Řeší slovní úlohy se zlomky a zapíše odpověď.' },
  ]

  const assessments: Assessment[] = []
  const selfAssessments: SelfAssessment[] = []
  const goals: Goal[] = []

  const thisMonday = weekStart(today())
  const now = today()

  function generate(
    subjectId: string,
    people: Student[],
    topics: [string, Fb][],
    weekday: number, // 0 = pondělí
    weeks: number,
    critIds: string[],
    alwaysScored: string[],
  ) {
    people.forEach((st, si) => {
      const start: Record<string, number> = {}
      const rate: Record<string, number> = {}
      for (const c of critIds) {
        start[c] = 2.6 + r() * 2.4
        rate[c] = 0.05 + r() * 0.25
      }
      for (let w = 0; w < weeks; w++) {
        const monday = addDays(thisMonday, -7 * (weeks - 1 - w))
        const date = addDays(monday, weekday)
        if (date > now) continue
        if (r() < 0.12 && !(st.id === 's-me1-0')) continue // občas chybí
        const [topic, fb] = topics[Math.min(topics.length - 1, Math.floor((w / weeks) * topics.length))]
        const scores: Record<string, Level> = {}
        const chosen = new Set([...alwaysScored, ...critIds.filter(() => r() < 0.45)])
        for (const c of critIds) {
          if (!chosen.has(c)) continue
          scores[c] = clamp(start[c] - rate[c] * w + (r() - 0.5) * 0.9)
        }
        // Ukázka z praxe: Adam Novák, samostatnost se zlepšuje 4 → 3 → 3 → 2 (1 = výborně).
        if (st.id === 's-me1-0' && subjectId === 'p-me1-inf') {
          const series = [5, 5, 4, 4, 4, 3, 3, 2, 2]
          scores['k-samostatnost'] = series[Math.max(0, series.length - weeks + w)] as Level
          scores['k-inf-suma'] = clamp(4 - w * 0.35)
          scores['k-znalosti'] = clamp(3 - w * 0.2)
        }
        const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(scores).length)
        const id = `h-${subjectId}-${si}-${w}`
        const strong = avg <= 2.4
        const goalStatus: LessonGoalStatus = avg <= 2 ? (r() < 0.85 ? 'splneno' : 'castecne') : avg <= 3 ? (r() < 0.6 ? 'castecne' : 'splneno') : r() < 0.6 ? 'nesplneno' : 'castecne'
        const good = pick(fb.good)
        const todo = strong && r() < 0.5 ? '' : pick(fb.todo)
        const teacherQ: Partial<Record<TeacherQKey, TeacherAnswer>> = {
          zvladnuti: { choices: [avg <= 1.8 ? 'Učivo zvládá výborně a dokáže ho použít.' : avg <= 2.6 ? 'Učivo zvládá dobře, s drobnými nejistotami.' : avg <= 3.4 ? 'Zvládá základy, potřebuje další procvičení.' : 'Učivo zatím nezvládá, potřebuje podporu.'], note: '' },
          samostatnost: { choices: [(scores['k-samostatnost'] ?? avg) <= 2 ? 'Pracuje samostatně.' : (scores['k-samostatnost'] ?? avg) <= 3 ? 'Občas potřebuje pomoc.' : 'Potřebuje časté vedení.'], note: '' },
          povedlo: { choices: [], note: good },
          ...(todo ? { procvicit: { choices: [], note: todo } } : {}),
        }
        const nextText = pick(fb.next)
        const a: Assessment = {
          id,
          studentId: st.id,
          subjectId,
          date,
          periodType: 'hodina',
          periodFrom: date,
          periodTo: date,
          units: subjectId === 'p-me1-inf' ? ['svp-inf-2'] : subjectId === 'p-7a-mat' && UNIT_OF[topic] ? [UNIT_OF[topic]] : [],
          topic,
          goals: [{ id: `c-${subjectId}-${si}-${w}`, text: fb.goal, status: goalStatus }],
          skills: Object.keys(scores),
          scores,
          skillNotes: {},
          teacherQ: { ...teacherQ, dalsi: { choices: [], note: nextText } },
          feedback: { good, todo, next: nextText },
          swot: { s: '', w: '', o: '', t: '', proposed: false },
          nextGoal: w % 2 === 1 || w === weeks - 1 ? nextText : '',
          status: 'dokoncene',
          selfCode: null,
          createdAt: `${date}T07:${String(10 + si).padStart(2, '0')}:00.000Z`,
          updatedAt: `${date}T07:${String(10 + si).padStart(2, '0')}:00.000Z`,
        }
        if (w >= weeks - 3 && r() < 0.5) {
          a.swot = {
            s: a.feedback.good,
            w: a.feedback.todo,
            o: `Další krok: ${a.feedback.next}`,
            t: '',
            rec: '',
            proposed: false,
          }
        }
        assessments.push(a)
        if (a.nextGoal) {
          const due = addDays(date, 14)
          goals.push({
            id: `g-${id}`,
            studentId: st.id,
            subjectId,
            text: a.nextGoal,
            setOn: date,
            due,
            status: due < now ? (r() < 0.72 ? 'splneny' : 'nesplneny') : 'rozpracovany',
            assessmentId: id,
          })
        }
        if (w >= weeks - 5 && r() < 0.55) {
          // Sebehodnocení podle univerzálního dotazníku – odpovědi zhruba odpovídají výkonu.
          const know = scores['k-znalosti'] ?? Math.round(avg)
          const indep = scores['k-samostatnost'] ?? Math.round(avg)
          const band = (l: number) => (l <= 2 ? 3 : l === 3 ? 2 : 1) as 1 | 2 | 3
          const jitter = (b: 1 | 2 | 3) => (r() < 0.2 ? (Math.min(3, Math.max(1, b + (r() < 0.5 ? -1 : 1))) as 1 | 2 | 3) : b)
          const understanding = jitter(band(know))
          const work = jitter(band(indep))
          const wentWell = ['pochopil', 'splnil', 'samostatne', 'spoluprace', 'nevzdal'].filter((_, n) => r() < (n < 2 ? 0.55 : 0.3))
          const improve =
            understanding === 3 && goalStatus === 'splneno' && r() < 0.5
              ? ['nic']
              : ['porozumet', 'procvicovat', 'samostatneji', 'soustredit', 'spolupracovat'].filter((_, n) => r() < (n < 2 ? 0.45 : 0.2))
          selfAssessments.push({
            id: `z-${id}`,
            assessmentId: id,
            form: selfFormFor('hodina', date, date),
            answers: {
              understanding,
              work,
              wentWell: wentWell.length ? wentWell : ['splnil'],
              improve: improve.length ? improve : ['procvicovat'],
              goalMet: goalStatus === 'splneno' ? (r() < 0.85 ? 'ano' : 'castecne') : goalStatus === 'castecne' ? (r() < 0.7 ? 'castecne' : 'ano') : r() < 0.6 ? 'zatimne' : 'castecne',
              nextWish: pick(NEXT_WISH),
            },
            submittedAt: `${date}T08:00:00.000Z`,
          })
        }
      }
    })
  }

  const defaults = DEFAULT_CRITERIA.map((c) => c.id)
  generate('p-me1-inf', students.filter((s) => s.classId === 'c-me1'), INFO_TOPICS, 1, 9,
    [...defaults, 'k-inf-suma'], ['k-samostatnost', 'k-znalosti'])
  generate('p-7a-mat', students.filter((s) => s.classId === 'c-7a'), MATH_TOPICS, 2, 8,
    [...defaults.filter((c) => c !== 'k-digitalni'), 'k-7a-ulohy'], ['k-znalosti', 'k-reseni'])
  generate('p-me1-mat', students.filter((s) => s.classId === 'c-me1').slice(0, 5), MATH_TOPICS, 3, 4,
    defaults, ['k-znalosti'])

  const phrases: Phrase[] = PHRASES.map((p) => ({ ...p, id: uid('v') }))

  const base: DB = {
    version: 3,
    schools,
    classes,
    students,
    subjects,
    criteria,
    units: structuredClone(DEMO_UNITS),
    assessments,
    selfAssessments,
    attachments: [],
    documents: [],
    goals,
    summaries: [],
    phrases,
    audit: [],
    settings: { role: 'ucitel', teacherName: 'Mgr. Jana Učitelová', schoolType: 'SS' },
  }

  // Měsíční hodnocení Adama za minulý měsíc se schválenou formativní zprávou.
  {
    const lm = rangeFor('mesic', addDays(periodFor('mesic', now).from, -1))
    const id = 'h-adam-mesic'
    const a: Assessment = {
      id,
      studentId: 's-me1-0',
      subjectId: 'p-me1-inf',
      date: lm.to,
      periodType: 'mesic',
      periodFrom: lm.from,
      periodTo: lm.to,
      units: ['svp-inf-2'],
      topic: 'Práce v Excelu',
      goals: [
        { id: 'c-adam-1', text: 'Žák vytvoří tabulku a použije funkce SUMA, PRŮMĚR, MIN a MAX.', status: 'castecne' },
        { id: 'c-adam-2', text: 'Žák vytvoří z dat vhodný graf s popisky.', status: 'splneno' },
      ],
      skills: ['k-znalosti', 'k-reseni', 'k-samostatnost', 'k-digitalni', 'k-zpetna-vazba'],
      scores: { 'k-znalosti': 2, 'k-reseni': 3, 'k-samostatnost': 2, 'k-digitalni': 2 },
      skillNotes: { 'k-samostatnost': 'Během měsíce výrazně zesamostatněl, nápovědu potřebuje jen u nových funkcí.', 'k-reseni': 'U funkce PRŮMĚR si plete oblast dat.' },
      teacherQ: {
        zvladnuti: { choices: ['Učivo zvládá dobře, s drobnými nejistotami.'], note: '' },
        samostatnost: { choices: ['Samostatnost se zlepšuje.'], note: '' },
        povedlo: { choices: ['Samostatná práce.', 'Zlepšení oproti minulému období.'], note: 'Grafy s popisky zvládá bez pomoci.' },
        procvicit: { choices: ['Přesnost a kontrola výsledků.'], note: 'Výběr oblasti u funkce PRŮMĚR.' },
        dalsi: { choices: ['Řešit úlohy samostatně bez nápovědy.'], note: 'Samostatně vypočítat průměr pěti čísel.' },
      },
      feedback: { good: 'Samostatná práce. Zlepšení oproti minulému období. Grafy s popisky zvládá bez pomoci.', todo: 'Přesnost a kontrola výsledků. Výběr oblasti u funkce PRŮMĚR.', next: 'Řešit úlohy samostatně bez nápovědy. Samostatně vypočítat průměr pěti čísel.' },
      swot: { s: '', w: '', o: '', t: '', proposed: true },
      nextGoal: 'Samostatně vypočítat průměr pěti čísel.',
      status: 'dokoncene',
      selfCode: null,
      createdAt: `${lm.to}T14:00:00.000Z`,
      updatedAt: `${lm.to}T14:30:00.000Z`,
    }
    const self: SelfAssessment = {
      id: 'z-adam-mesic',
      assessmentId: id,
      form: selfFormFor('mesic', lm.from, lm.to),
      answers: { understanding: 2, work: 3, wentWell: ['m-p2', 'm-p4'], improve: ['m-z1'], goalMet: 'castecne', nextWish: 'Zvládnout všechny funkce bez pomoci.' },
      submittedAt: `${lm.to}T13:00:00.000Z`,
    }
    const tmp = { ...structuredClone({ schools, classes, students, subjects, criteria, units: DEMO_UNITS, assessments, selfAssessments, attachments: [], documents: [], goals, summaries: [], phrases: [], audit: [], settings: { role: 'ucitel', teacherName: '', schoolType: 'SS' } }), version: 3 } as DB
    const rep = reportText(tmp, a, self, 'stredni')
    a.swot = proposeDevelopment(tmp, a, self)
    a.report = { length: 'stredni', text: rep.text, original: rep.text, source: 'sablona', approved: true, approvedAt: `${lm.to}T14:30:00.000Z`, missing: rep.missing, attachments: [] }
    assessments.push(a)
    selfAssessments.push(self)
  }
  // Rozpracované hodnocení (vyplněné jen údaje o žákovi) – pro přehled nedokončených.
  assessments.push({
    id: 'h-draft-bara',
    studentId: 's-me1-1',
    subjectId: 'p-me1-inf',
    date: now,
    periodType: 'tyden',
    periodFrom: thisMonday,
    periodTo: addDays(thisMonday, 6),
    units: ['svp-inf-2'],
    topic: 'Grafy',
    goals: [{ id: 'c-bara-1', text: 'Žák vytvoří z dat vhodný graf s popisky.', status: null }],
    skills: [],
    scores: {},
    skillNotes: {},
    teacherQ: {},
    feedback: { good: '', todo: '', next: '' },
    swot: { s: '', w: '', o: '', t: '', proposed: true },
    nextGoal: '',
    status: 'rozpracovane',
    selfCode: null,
    createdAt: `${now}T06:30:00.000Z`,
    updatedAt: `${now}T06:30:00.000Z`,
  })

  // Ukázkové souhrny: schválený měsíční (minulý měsíc) a rozpracovaný týdenní (minulý týden).
  const summaries: Summary[] = []
  const lastMonth = periodFor('mesic', addDays(periodFor('mesic', now).from, -1))
  summaries.push({
    id: 'sum-adam-mesic',
    studentId: 's-me1-0',
    subjectId: 'p-me1-inf',
    kind: 'mesic',
    from: lastMonth.from,
    to: lastMonth.to,
    sections: generateSummary(base, 's-me1-0', 'p-me1-inf', 'mesic', lastMonth.from, lastMonth.to),
    teacherNote: 'Adam během měsíce výrazně zesamostatněl. Pokračujeme v procvičování funkce PRŮMĚR.',
    status: 'schvaleno',
    version: 1,
    createdAt: `${lastMonth.to}T15:00:00.000Z`,
    approvedAt: `${lastMonth.to}T15:20:00.000Z`,
  })
  const lastWeek = periodFor('tyden', addDays(thisMonday, -1))
  for (const sid of ['s-me1-1', 's-me1-3']) {
    summaries.push({
      id: `sum-${sid}-tyden`,
      studentId: sid,
      subjectId: 'p-me1-inf',
      kind: 'tyden',
      from: lastWeek.from,
      to: lastWeek.to,
      sections: generateSummary(base, sid, 'p-me1-inf', 'tyden', lastWeek.from, lastWeek.to),
      teacherNote: '',
      status: 'navrh',
      version: 1,
      createdAt: `${lastWeek.to}T10:00:00.000Z`,
      approvedAt: null,
    })
  }

  const name = (id: string) => {
    const s = students.find((x) => x.id === id)!
    return `${s.firstName} ${s.lastName}`
  }
  const audit: AuditEntry[] = [...assessments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((a) => ({ id: uid('a'), at: a.createdAt, action: 'vytvořeno', entity: 'hodnocení', label: `${name(a.studentId)} · ${a.topic}` }))
  audit.push({ id: uid('a'), at: summaries[0].approvedAt!, action: 'schváleno', entity: 'souhrn', label: `${name('s-me1-0')} · v1` })
  audit.sort((a, b) => b.at.localeCompare(a.at))

  return { ...base, summaries, audit }
}
