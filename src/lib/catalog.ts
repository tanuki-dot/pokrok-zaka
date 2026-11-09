import type { Criterion, TopicUnit } from './types'

/*
 * Hodnocené dovednosti (pokrokveskole.docx, snímek 3 A) a ukázkový katalog tematických
 * celků ŠVP. Katalog je jen ukázka – škola si ho doplní podle svého ŠVP (vlastní celky).
 */

/** Společné dovednosti pro všechny předměty. „k-znalosti“, „k-samostatnost“ a „k-spoluprace“
 *  zachovávají id ze starších verzí, aby na sebe historie navazovala. */
export const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'k-samostatnost', subjectId: null, name: 'Samostatnost', question: 'Zvládne pracovat bez pomoci?' },
  { id: 'k-aktivita', subjectId: null, name: 'Aktivita', question: 'Zapojuje se aktivně do výuky?' },
  { id: 'k-spoluprace', subjectId: null, name: 'Spolupráce', question: 'Dokáže pracovat s ostatními?' },
  { id: 'k-komunikace', subjectId: null, name: 'Komunikace', question: 'Srozumitelně vyjadřuje své myšlenky a postupy?' },
  { id: 'k-znalosti', subjectId: null, name: 'Porozumění učivu', question: 'Rozumí žák učivu a dokáže ho vysvětlit?' },
  { id: 'k-reseni', subjectId: null, name: 'Řešení problémů', question: 'Dokáže učivo použít při řešení úloh?' },
  { id: 'k-kriticke', subjectId: null, name: 'Kritické myšlení', question: 'Ověřuje informace a posuzuje výsledky?' },
  { id: 'k-tvorivost', subjectId: null, name: 'Tvořivost', question: 'Přichází s vlastními nápady a řešeními?' },
  { id: 'k-organizace', subjectId: null, name: 'Organizace práce', question: 'Plánuje si práci a dokončí ji včas?' },
  { id: 'k-zodpovednost', subjectId: null, name: 'Zodpovědnost', question: 'Plní povinnosti a nese odpovědnost za svou práci?' },
  { id: 'k-chyba', subjectId: null, name: 'Práce s chybou', question: 'Dokáže najít chybu a poučit se z ní?' },
  { id: 'k-sebereflexe', subjectId: null, name: 'Sebehodnocení', question: 'Ví, co umí a co potřebuje zlepšit?' },
  { id: 'k-zpetna-vazba', subjectId: null, name: 'Využívání zpětné vazby', question: 'Využívá zpětnou vazbu ke zlepšení?' },
  { id: 'k-vytrvalost', subjectId: null, name: 'Vytrvalost', question: 'Nevzdává se při obtížích a dotáhne práci do konce?' },
  { id: 'k-digitalni', subjectId: null, name: 'Digitální dovednosti', question: 'Účelně a bezpečně používá digitální technologie?' },
  { id: 'k-informace', subjectId: null, name: 'Práce s informacemi', question: 'Vyhledá, posoudí a zpracuje informace?' },
  { id: 'k-prezentace', subjectId: null, name: 'Prezentace výsledků', question: 'Srozumitelně představí výsledky své práce?' },
  { id: 'k-pravidla', subjectId: null, name: 'Dodržování pravidel', question: 'Dodržuje dohodnutá pravidla a pokyny?' },
]

/** Dovednosti ze starších verzí – zůstávají v historii, pro nová hodnocení se nenabízí. */
export const LEGACY_CRITERIA: Criterion[] = [
  { id: 'k-dovednosti', subjectId: null, name: 'Dovednosti (starší)', question: 'Dokáže učivo použít?', archived: true },
  { id: 'k-ukoly', subjectId: null, name: 'Plnění úkolů (starší)', question: 'Dokončí zadanou práci?', archived: true },
  { id: 'k-pokrok', subjectId: null, name: 'Pokrok (starší)', question: 'Zlepšuje se?', archived: true },
  { id: 'k-sebehodnoceni', subjectId: null, name: 'Sebehodnocení (starší)', question: 'Ví, co umí a co potřebuje zlepšit?', archived: true },
]

const u = (id: string, subjectName: string, grades: number[], schoolType: 'ZS' | 'SS' | undefined, name: string, goals: string[]): TopicUnit => ({
  id, subjectName, grades, schoolType, name, goals,
})

/** Ukázkový katalog tematických celků (nenahrazuje ŠVP školy). */
export const DEMO_UNITS: TopicUnit[] = [
  // Informatika, SŠ 1. ročník
  u('svp-inf-1', 'informatika', [1], 'SS', 'Základy práce s počítačem a operační systém', ['Žák se orientuje v operačním systému a spravuje soubory a složky.', 'Žák bezpečně ukládá a zálohuje svou práci.']),
  u('svp-inf-2', 'informatika', [1], 'SS', 'Tabulkový procesor', ['Žák vytvoří tabulku a použije funkce SUMA, PRŮMĚR, MIN a MAX.', 'Žák sestaví vzorec s odkazy na buňky a ověří jeho výsledek.', 'Žák vytvoří z dat vhodný graf s popisky.']),
  u('svp-inf-3', 'informatika', [1], 'SS', 'Textový editor a typografie', ['Žák upraví dokument podle typografických pravidel a použije styly.']),
  u('svp-inf-4', 'informatika', [1], 'SS', 'Prezentace informací', ['Žák připraví přehlednou prezentaci a srozumitelně ji přednese.']),
  u('svp-inf-5', 'informatika', [1, 2], 'SS', 'Algoritmizace a programování', ['Žák zapíše jednoduchý algoritmus a otestuje ho na příkladech.']),
  u('svp-inf-6', 'informatika', [1, 2], 'SS', 'Bezpečnost a etika na internetu', ['Žák rozpozná rizika na internetu a popíše, jak se chránit.']),
  // Matematika, SŠ 1. ročník
  u('svp-mat-ss-1', 'matematika', [1], 'SS', 'Číselné obory', ['Žák provádí početní operace v oboru reálných čísel a odhaduje výsledky.']),
  u('svp-mat-ss-2', 'matematika', [1], 'SS', 'Algebraické výrazy', ['Žák upravuje algebraické výrazy a rozkládá je na součin.']),
  u('svp-mat-ss-3', 'matematika', [1], 'SS', 'Lineární rovnice a nerovnice', ['Žák řeší lineární rovnice a ověří správnost řešení zkouškou.']),
  u('svp-mat-ss-4', 'matematika', [1, 2], 'SS', 'Funkce', ['Žák načrtne graf lineární funkce a popíše její vlastnosti.']),
  // Matematika, ZŠ 7. ročník
  u('svp-mat-7-1', 'matematika', [7], 'ZS', 'Racionální čísla – zlomky', ['Žák krátí a rozšiřuje zlomky a převádí je na základní tvar.', 'Žák sčítá a odčítá zlomky s různým jmenovatelem.', 'Žák řeší slovní úlohy se zlomky a zapíše odpověď.']),
  u('svp-mat-7-2', 'matematika', [7], 'ZS', 'Desetinná čísla', ['Žák převádí zlomky na desetinná čísla a porovnává je.']),
  u('svp-mat-7-3', 'matematika', [7], 'ZS', 'Poměr a přímá úměrnost', ['Žák řeší úlohy s poměrem a přímou úměrností.']),
  u('svp-mat-7-4', 'matematika', [7], 'ZS', 'Procenta', ['Žák vypočítá procentovou část, základ i počet procent.']),
  u('svp-mat-7-5', 'matematika', [7], 'ZS', 'Trojúhelníky a čtyřúhelníky', ['Žák narýsuje trojúhelník a čtyřúhelník podle zadání.']),
  // Český jazyk, ZŠ 7. ročník
  u('svp-cj-7-1', 'český jazyk', [7], 'ZS', 'Tvarosloví – slovní druhy', ['Žák určí slovní druhy a mluvnické kategorie ve větě.']),
  u('svp-cj-7-2', 'český jazyk', [7], 'ZS', 'Skladba – věta jednoduchá', ['Žák určí základní a rozvíjející větné členy.']),
  u('svp-cj-7-3', 'český jazyk', [7], 'ZS', 'Pravopis', ['Žák správně píše i/y po obojetných souhláskách a zdůvodní pravopis.']),
  u('svp-cj-7-4', 'český jazyk', [7], 'ZS', 'Sloh – popis a charakteristika', ['Žák napíše souvislý popis s vhodnou stavbou a jazykovými prostředky.']),
  u('svp-cj-7-5', 'český jazyk', [7], 'ZS', 'Literatura – pověsti a báje', ['Žák převypráví pověst a určí její znaky.']),
]

/** Tematické celky vhodné pro předmět a ročník třídy. */
export function unitsFor(units: TopicUnit[], subjectName: string, grade?: number, schoolType?: 'ZS' | 'SS') {
  const n = subjectName.trim().toLowerCase()
  return units.filter(
    (x) =>
      x.subjectName === n &&
      (x.custom || !grade || x.grades.length === 0 || x.grades.includes(grade)) &&
      (x.custom || !schoolType || !x.schoolType || x.schoolType === schoolType),
  )
}
