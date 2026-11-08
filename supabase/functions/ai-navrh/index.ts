// Supabase Edge Function: návrhy pomocí AI pro aplikaci Pokrok žáka.
//
//   task = "cile"      → návrh vzdělávacích cílů
//   task = "hodnoceni" → slovní formativní hodnocení (délka kratke | stredni | dlouhe)
//   task = "rozvoj"    → individuální rozvoj žáka (4 pole)
//
// Nasazení:
//   supabase secrets set ANTHROPIC_API_KEY=...
//   supabase functions deploy ai-navrh
// Funkce ověřuje JWT (anon key projektu), klíč k API zůstává jen na serveru.
// Aplikace posílá pseudonymizovaný kontext bez jména a třídy žáka (src/lib/ai.ts).

import Anthropic from 'npm:@anthropic-ai/sdk@1.1.0'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
const MODEL = 'claude-opus-5-5'

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Stabilní systémový prompt (bez proměnných údajů), aby šel cachovat.
const SYSTEM = `Jsi zkušený pedagog a pomáháš učitelům české základní a střední školy s formativním hodnocením žáků.
Dostaneš pseudonymizovaný kontext jednoho hodnocení ve formátu JSON (údaje o předmětu, ročníku, období, tematických celcích, vzdělávacích cílech, hodnocení dovedností učitelem, dotazník učitele, sebehodnocení žáka, předchozí hodnocení a druhy doložených prací).

Pravidla:
- Vycházej výhradně z dodaných údajů. Nevymýšlej osobní vlastnosti, diagnózy, rodinné okolnosti ani nepodložené obtíže.
- Škála hodnocení dovedností: 1 = výborně (nejlepší), 2 = velmi dobře, 3 = částečně zvládá, 4 = potřebuje výraznou pomoc, 5 = zatím nezvládá. Dovednosti, které v údajích nejsou, nejsou hodnocené – neuváděj je a nepovažuj je za slabé.
- Důsledně odlišuj hodnocení učitele od vlastního pohledu žáka (sebehodnocení). Sebehodnocení je subjektivní pohled žáka, ne objektivní hodnocení. Případné rozdíly formuluj citlivě a věcně.
- Cíl se splněním „neoznačeno“ nikdy nepopisuj jako splněný ani nesplněný.
- Piš česky, srozumitelně pro žáka i rodiče, pozitivně a pedagogicky vhodně. Žáka neoslovuj jménem, piš genderově neutrálně (např. „zvládá“, „potřebuje“, „žák“).
- Hodnocení slouží ke zpětné vazbě a podpoře rozvoje, není to známka.`

const TASK_PROMPT: Record<string, (length?: string) => string> = {
  cile: () =>
    'Navrhni 3 až 5 konkrétních, ověřitelných vzdělávacích cílů pro hodnocené období. Formuluj je jako „Žák …“ a přizpůsob je předmětu, ročníku, tematickým celkům a délce období. Navaž na nesplněné nebo částečně splněné cíle z předchozích hodnocení, pokud jsou.',
  hodnoceni: (length) =>
    ({
      kratke: 'Napiš krátké formativní hodnocení v několika větách: co žák zvládá, co potřebuje zlepšit a jeden konkrétní další krok.',
      stredni: 'Napiš formativní hodnocení střední délky: podrobnější shrnutí výsledků a pokroku, zvládnuté znalosti a dovednosti, oblasti pro zlepšení a doporučení pro další učení. Odstavce odděl prázdným řádkem.',
      dlouhe: 'Napiš komplexní formativní hodnocení: podrobné zhodnocení znalostí a dovedností, porovnání s předchozími výsledky, sebehodnocení žáka (odlišené od hodnocení učitele), splnění vzdělávacích cílů a konkrétní doporučení. Odstavce odděl prázdným řádkem.',
    })[length ?? 'stredni'] +
    ' Do pole missing vypiš údaje, které chybí a hodnocení je proto bez nich (např. chybí sebehodnocení, u cíle není označeno splnění). Pokud nic nechybí, vrať prázdný seznam.',
  rozvoj: () =>
    'Vyplň individuální rozvoj žáka ve čtyřech polích: s = co žák zvládá (zvládnuté znalosti a dovednosti, úspěchy, samostatně zvládané činnosti, zaznamenaný pokrok); w = co potřebuje zlepšit (co vyžaduje procvičení, kde potřebuje podporu, konkrétní možnosti zlepšení); o = možnosti dalšího rozvoje (doporučené aktivity, prohlubování znalostí, nové dovednosti, další kroky); t = překážky v učení (jen doložené obtíže z údajů, potřebná podpora a jak je překonat). Pokud překážky nejsou v údajích doloženy, vrať v poli t přesně větu „Nebyly zaznamenány konkrétní překážky v učení.“',
}

const SCHEMA: Record<string, Record<string, unknown>> = {
  cile: {
    type: 'object',
    properties: { goals: { type: 'array', items: { type: 'string' } } },
    required: ['goals'],
    additionalProperties: false,
  },
  hodnoceni: {
    type: 'object',
    properties: { text: { type: 'string' }, missing: { type: 'array', items: { type: 'string' } } },
    required: ['text', 'missing'],
    additionalProperties: false,
  },
  rozvoj: {
    type: 'object',
    properties: { s: { type: 'string' }, w: { type: 'string' }, o: { type: 'string' }, t: { type: 'string' } },
    required: ['s', 'w', 'o', 't'],
    additionalProperties: false,
  },
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Použijte POST.' }, 405)

  let body: { task?: string; length?: string; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Neplatný JSON.' }, 400)
  }
  const task = body.task ?? ''
  if (!TASK_PROMPT[task]) return json({ error: 'Neznámý úkol.' }, 400)
  const context = JSON.stringify(body.context ?? {})
  if (context.length > 60_000) return json({ error: 'Kontext je příliš velký.' }, 413)

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA[task] } },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `${TASK_PROMPT[task](body.length)}\n\nKontext hodnocení:\n${context}` }],
    })
    if (response.stop_reason === 'refusal') return json({ error: 'AI požadavek odmítla.' }, 422)
    if (response.stop_reason === 'max_tokens') return json({ error: 'Odpověď AI byla příliš dlouhá.' }, 502)
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return json(JSON.parse(text))
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'AI je přetížená, zkuste to za chvíli.' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `Chyba AI (${e.status}).` }, 502)
    if (e instanceof SyntaxError) return json({ error: 'AI vrátila neplatnou odpověď.' }, 502)
    return json({ error: 'Neočekávaná chyba.' }, 500)
  }
})
