import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  ArrowRight, BookOpenCheck, CalendarRange, ClipboardCheck, FileDown, GitBranch, Grid2x2, QrCode, School, Users,
} from 'lucide-react'
import { useDB } from '../lib/store'
import { switchSchoolType } from '../lib/selection'
import { openPrivacy } from '../lib/privacy'
import { LEVELS } from '../lib/analysis'
import { cx } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { remoteEnabled } from '../lib/remote'

/*
 * Úvodní stránka. V demu vedou tlačítka rovnou do aplikace, se serverem na přihlášení.
 * Odkazy uvnitř stránky nepoužívají #kotvy (aplikace má HashRouter), ale scrollIntoView.
 */

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const STEPS = [
  ['Údaje o žákovi a cíl', 'Žák, třída, předmět, hodnocené období (hodina až školní rok), tematický celek ŠVP a vzdělávací cíle.'],
  ['Hodnocení učitele', 'Vybrané dovednosti na škále 1–5 s komentářem, krátký dotazník podle období a splnění každého cíle.'],
  ['Sebehodnocení žáka', 'Dotazník přes QR kód nebo odkaz – otázky odpovídají období, žák může přiložit svou práci.'],
  ['Formativní hodnocení', 'Zpráva pro žáka a rodiče v krátké, střední nebo dlouhé verzi a individuální rozvoj žáka.'],
  ['Kontrola a historie', 'Učitel zprávu upraví a schválí, pokrok žáka sleduje v historii a grafech.'],
]

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <Users size={22} />, title: 'Evidence', text: 'Školy, třídy, žáci a předměty. Seznam žáků nahrajete z Excelu.' },
  { icon: <ClipboardCheck size={22} />, title: 'Hodnocení 1–5', text: 'Deset dovedností pro všechny předměty a vlastní dovednosti. 1 = výborně … 5 = zatím nezvládá.' },
  { icon: <Grid2x2 size={22} />, title: 'Individuální rozvoj žáka', text: 'Co žák zvládá, co potřebuje zlepšit, možnosti rozvoje a překážky v učení – vytvoří se automaticky a učitel je upraví.' },
  { icon: <CalendarRange size={22} />, title: 'Týden · Měsíc · Pololetí', text: 'Souhrny a slovní hodnocení se skládají z krátkých záznamů. Učitel je upraví a schválí.' },
  { icon: <QrCode size={22} />, title: 'Sebehodnocení žáka', text: 'Jeden univerzální dotazník pro všechny předměty. Žák odpoví přes QR kód, odpovědi vidíte vedle svého hodnocení.' },
  { icon: <FileDown size={22} />, title: 'Výstupy', text: 'Tisk do PDF, export do Excelu a přehled třídy i celé školy.' },
]

const PRINCIPLES = [
  ['Žák se porovnává sám se sebou', 'Graf ukazuje vývoj jedné dovednosti v čase, ne pořadí ve třídě.'],
  ['Čísla nejsou známky', 'Úroveň 1–5 popisuje aktuální zvládnutí dovednosti: 1 = výborně, 5 = zatím nezvládá.'],
  ['Aplikace nic nedomýšlí', 'Souhrny vznikají jen z uložených záznamů a u každé věty je vidět, odkud pochází.'],
  ['Rozhoduje učitel', 'Návrh slovního hodnocení učitel upraví a schválí. Tisknout jde jen schválená verze.'],
]

/** Ukázka z praxe: samostatnost 4 → 3 → 3 → 2 za čtyři týdny (1 = výborně, 5 = zatím nezvládá). */
function HeroCard() {
  const weeks = [4, 3, 3, 2]
  const x = (i: number) => 34 + i * 76
  const y = (l: number) => 14 + (l - 1) * 24 // 1 (výborně) nahoře
  const path = weeks.map((l, i) => `${i ? 'L' : 'M'}${x(i)},${y(l)}`).join(' ')
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="absolute -inset-3 -z-10 rounded-[28px] bg-brand-100/60 blur-2xl" aria-hidden="true" />
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-[0_24px_60px_-28px_rgba(22,33,58,.35)] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sea-50 font-bold text-sea-700">AN</span>
          <div className="min-w-0">
            <div className="font-bold">Adam Novák</div>
            <div className="text-xs text-ink-faint">SŠ · ME1 · Informatika · Práce v Excelu</div>
          </div>
          <span className="ml-auto rounded-full bg-good-wash px-2.5 py-0.5 text-xs font-semibold text-good">zlepšení</span>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-semibold">Samostatnost</div>
            <div className="text-sm text-ink-faint">Zvládne pracovat bez pomoci?</div>
          </div>
          <div className="flex gap-1.5" aria-label="Vybraná úroveň 2 – velmi dobře">
            {LEVELS.map(({ level }) => (
              <span
                key={level}
                className={cx(
                  'tabular grid h-9 w-9 place-items-center rounded-xl border text-sm font-bold',
                  level === 2 ? 'border-transparent bg-ink text-surface shadow-md' : 'border-line text-ink-faint',
                )}
              >
                {level}
              </span>
            ))}
          </div>
        </div>

        <figure className="mt-5 rounded-2xl bg-canvas px-3 pb-2 pt-3">
          <svg viewBox="0 0 280 124" className="h-auto w-full" role="img" aria-label="Samostatnost po týdnech: 4, 3, 3, 2. Nižší číslo znamená lepší zvládnutí, zlepšení proto stoupá.">
            <rect x="24" y="2" width="248" height="36" rx="6" fill="var(--color-lv1)" fillOpacity="0.08" />
            {[1, 2, 3, 4, 5].map((l) => (
              <g key={l}>
                <line x1="24" x2="272" y1={y(l)} y2={y(l)} stroke="var(--color-line)" strokeWidth="1" />
                <text x="12" y={y(l) + 4} textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">{l}</text>
              </g>
            ))}
            <path d={path} fill="none" stroke="var(--color-sea-500)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {weeks.map((l, i) => (
              <circle key={i} cx={x(i)} cy={y(l)} r={i === weeks.length - 1 ? 5.5 : 4} fill={i === weeks.length - 1 ? `var(--color-lv${l})` : 'var(--color-surface)'} stroke={i === weeks.length - 1 ? 'var(--color-surface)' : 'var(--color-sea-500)'} strokeWidth="2" />
            ))}
          </svg>
          <figcaption className="flex justify-between px-[6%] text-[11px] text-ink-faint">
            {weeks.map((_, i) => <span key={i}>{i + 1}. týden</span>)}
          </figcaption>
        </figure>
        <p className="mt-2 text-xs text-ink-faint">4 → 3 → 3 → 2: z „potřebuje výraznou pomoc“ na „velmi dobře“.</p>

        <div className="mt-4 rounded-2xl border border-line p-3 text-sm">
          <span className="font-semibold text-sea-700">Další krok:</span> Samostatně vypočítat průměr pěti čísel.
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const db = useDB()
  const nav = useNavigate()

  const openDemo = (type?: 'ZS' | 'SS') => {
    if (type && type !== db.settings.schoolType) switchSchoolType(db, type)
    nav(remoteEnabled ? '/prihlaseni' : db.settings.role === 'vedeni' ? '/vedeni' : '/prehled')
  }
  const cta = remoteEnabled ? 'Přihlásit se' : 'Vyzkoušet demo'

  return (
    <div className="min-h-full bg-canvas">
      {/* Horní lišta */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white"><BookOpenCheck size={20} /></span>
            <span className="font-display text-[17px] font-bold">Pokrok žáka</span>
          </div>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Sekce stránky">
            {[['postup', 'Jak to funguje'], ['funkce', 'Funkce'], ['zasady', 'Zásady']].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sea-50 hover:text-ink">
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle compact />
            <button
              onClick={() => openDemo()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              {cta} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1160px] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-20">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Formativní hodnocení a sledování individuálního pokroku · ZŠ a SŠ</p>
          <h1 className="mt-4 text-[clamp(2.25rem,6vw,3.75rem)] font-bold leading-[1.05]">
            Formativní hodnocení, které stihnete v&nbsp;každé hodině.
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-soft sm:text-lg">
            Ohodnoťte konkrétní dovednost na škále 1–5, napište, co se povedlo a co dál, a stanovte další cíl. Z krátkých záznamů pak vznikne týdenní, měsíční i pololetní přehled pokroku každého žáka.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => openDemo()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-12px_rgba(14,148,136,.8)] hover:bg-brand-600"
            >
              {cta} <ArrowRight size={18} />
            </button>
            <button
              onClick={() => scrollTo('postup')}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-surface px-6 py-3.5 text-base font-semibold hover:border-sea-500 hover:text-sea-600"
            >
              Jak to funguje
            </button>
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            {remoteEnabled
              ? 'Testovací provoz: po přihlášení si nahrajete ukázkové třídy s fiktivními žáky ZŠ i SŠ.'
              : 'Bez přihlášení a instalace. Demo obsahuje fiktivní žáky ZŠ i SŠ.'}
          </p>
        </div>
        <HeroCard />
      </section>

      {/* Postup */}
      <section id="postup" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-[1160px] px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold">Jak vypadá běžná hodina</h2>
          <p className="mt-3 max-w-[60ch] text-ink-soft">Hodnocení musí být rychlé. Pět kroků, žádné dlouhé psaní.</p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-5">
                <span className="tabular grid h-9 w-9 place-items-center rounded-xl bg-sea-500 font-display font-bold text-white">{i + 1}</span>
                <h3 className="text-[17px] font-bold leading-snug">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-brand-50 px-5 py-4 text-brand-700">
            <span className="font-semibold">Aplikace z toho postupně sestaví přehled pokroku:</span>
            <span className="font-display text-lg font-bold">Týden · Měsíc · Pololetí</span>
          </div>
        </div>
      </section>

      {/* Funkce */}
      <section id="funkce" className="scroll-mt-20 mx-auto max-w-[1160px] px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold">Co aplikace umí</h2>
        <p className="mt-3 max-w-[60ch] text-ink-soft">Je univerzální: kritéria si nastavíte pro každý předmět, aniž byste museli zakládat nový systém.</p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-line bg-surface p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sea-50 text-sea-600">{f.icon}</span>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{f.text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-ink-faint">Škála úrovní</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-5">
            {LEVELS.map((l) => (
              <li key={l.level} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 sm:flex-col sm:items-start sm:gap-2">
                <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: `var(--color-lv${l.level})` }}>{l.level}</span>
                <span className="text-sm leading-snug"><strong>{l.name}</strong><span className="block text-ink-soft">{l.desc}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Zásady */}
      <section id="zasady" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1160px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
          <div>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold">Aplikace zaznamenává vývoj. Rozhoduje učitel.</h2>
            <p className="mt-4 max-w-[52ch] text-ink-soft">
              Učitel hodnotí konkrétní dovednost, poskytuje zpětnou vazbu a stanovuje další cíl. Aplikace slouží k formativnímu hodnocení, ne jen k zapisování.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map(([title, text]) => (
              <li key={title} className="rounded-2xl bg-canvas p-5">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Vedení školy */}
      <section className="mx-auto max-w-[1160px] px-4 py-16 sm:px-6 lg:py-20">
        <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><School size={24} /></span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold">Pro vedení školy</h2>
            <p className="mt-1.5 max-w-[70ch] text-[15px] leading-relaxed text-ink-soft">
              Souhrnná čísla bez jmen žáků: zda učitelé dávají průběžnou zpětnou vazbu, stanovují cíle a sledují pokrok. Podporuje principy Kvalitní školy, nenahrazuje hodnoticí systém České školní inspekce.
            </p>
          </div>
        </div>
      </section>

      {/* Výzva k vyzkoušení */}
      <section className="bg-sea-500">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[clamp(1.6rem,3.5vw,2.25rem)] font-bold text-white">Vyzkoušejte si to na ukázkové třídě</h2>
            <p className="mt-2 max-w-[56ch] text-white/85">
              Fiktivní žáci a záznamy za posledních devět týdnů.{' '}
              {remoteEnabled ? 'Po přihlášení zvolte „Nahrát ukázková data“.' : 'Data zůstávají jen ve vašem prohlížeči.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={() => openDemo('ZS')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-semibold text-[#1b45a3] hover:bg-white/90">
              Demo ZŠ · třída 7.A <ArrowRight size={17} />
            </button>
            <button onClick={() => openDemo('SS')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-semibold text-[#1b45a3] hover:bg-white/90">
              Demo SŠ · třída ME1 <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1160px] flex-col gap-3 px-4 py-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Pokrok žáka · verze {__APP_VERSION__} · licence MIT</span>
          <button onClick={openPrivacy} className="font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline">Soukromí</button>
        </span>
        <a href="https://github.com/tanuki-dot/pokrok-zaka" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-ink-soft hover:text-ink">
          <GitBranch size={15} /> Zdrojový kód na GitHubu
        </a>
      </footer>
    </div>
  )
}
