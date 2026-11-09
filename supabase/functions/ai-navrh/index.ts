// Supabase Edge Function: návrhy pomocí AI pro aplikaci Pokrok žáka.
//
//   task = "cile"      → návrh vzdělávacích cílů
//   task = "hodnoceni" → slovní formativní hodnocení (délka kratke | stredni | dlouhe)
//   task = "rozvoj"    → individuální rozvoj žáka (4 pole)
//
// AI: Google Gemini (free tier), výchozí model gemini-3.1-flash-lite.
// Nasazení:
//   supabase secrets set GEMINI_API_KEY=...        (klíč z Google AI Studio)
//   supabase secrets set GEMINI_MODEL=...          (nepovinné, přepíše výchozí model)
//   supabase functions deploy ai-navrh --use-api
// Funkci smí volat jen přihlášený učitel (ověří se jeho přihlášení), počet požadavků je
// omezený na den. Klíč k API zůstává jen na serveru. Aplikace posílá pseudonymizovaný
// kontext bez jména a třídy žáka (src/lib/ai.ts).

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite'
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '60')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Extrakce textu z nahraných dokumentů (ŠVP, plány, podpůrná opatření) ─────
async function extractText(bytes: Uint8Array, name: string, mime: string): Promise<string> {
  const lower = name.toLowerCase()
  try {
    if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
      const { extractText, getDocumentProxy } = await import('npm:unpdf@0.12.1')
      const pdf = await getDocumentProxy(bytes)
      const { text } = await extractText(pdf, { mergePages: true })
      return Array.isArray(text) ? text.join('\n') : text
    }
    if (lower.endsWith('.docx')) {
      const { unzipSync, strFromU8 } = await import('npm:fflate@0.8.2')
      const xml = unzipSync(bytes)['word/document.xml']
      if (!xml) return ''
      return strFromU8(xml).replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/\n{2,}/g, '\n').trim()
    }
    if (lower.endsWith('.txt') || lower.endsWith('.rtf') || mime.startsWith('text/')) {
      return new TextDecoder().decode(bytes)
    }
  } catch (_e) {
    /* nečitelný dokument – přeskočíme */
  }
  return ''
}

type DocRow = { id: string; name: string; mime: string; kind: string; scope: string; student_id: string | null; school_id: string | null }

async function excerptsFor(rows: DocRow[]): Promise<string> {
  let out = ''
  for (const d of rows) {
    const path = d.scope === 'skola' ? `skola/${d.school_id}/${d.id}` : `${d.student_id}/${d.id}`
    const { data: blob } = await admin.storage.from('dokumenty').download(path)
    if (!blob) continue
    const text = (await extractText(new Uint8Array(await blob.arrayBuffer()), d.name, d.mime)).replace(/\s+/g, ' ').trim()
    if (text) out += `\n\n[${d.name}]\n${text.slice(0, 6000)}`
    if (out.length > 14000) break
  }
  return out.slice(0, 14000)
}

async function schoolDocExcerpts(schoolId: string, subjectId?: string): Promise<string> {
  let q = admin.from('documents').select('id,name,mime,kind,scope,student_id,school_id').eq('scope', 'skola').eq('school_id', schoolId).limit(10)
  if (subjectId) q = q.eq('subject_id', subjectId)
  const { data } = await q
  const text = await excerptsFor((data ?? []) as DocRow[])
  return text ? `\n\nVýňatky ze ŠVP a tematických plánů školy (ber je jako oporu pro návrh cílů a dovedností):${text}` : ''
}

async function studentDocExcerpts(studentId: string): Promise<string> {
  const { data } = await admin.from('documents').select('id,name,mime,kind,scope,student_id,school_id').eq('scope', 'zak').eq('student_id', studentId).limit(10)
  const text = await excerptsFor((data ?? []) as DocRow[])
  return text ? `\n\nPodpůrná opatření žáka z dokumentů (PLPP, IVP, doporučení PPP/SPC). Zohledni individuální potřeby a doporučenou podporu, ale neopakuj v textu jména ani diagnózy:${text}` : ''
}

const SYSTEM = `Jsi zkušený pedagog a pomáháš učitelům české základní a střední školy s formativním hodnocením žáků.
Dostaneš pseudonymizovaný kontext jednoho hodnocení ve formátu JSON (údaje o předmětu, ročníku, období, tematických celcích, vzdělávacích cílech, hodnocení dovedností učitelem, dotazník učitele, sebehodnocení žáka, předchozí hodnocení a druhy doložených prací).

Pravidla:
- Vycházej výhradně z dodaných údajů. Nevymýšlej osobní vlastnosti, diagnózy, rodinné okolnosti ani nepodložené obtíže.
- Škála hodnocení dovedností: 1 = výborně (nejlepší), 2 = velmi dobře, 3 = částečně zvládá, 4 = potřebuje výraznou pomoc, 5 = zatím nezvládá. Dovednosti, které v údajích nejsou, nejsou hodnocené – neuváděj je a nepovažuj je za slabé.
- Důsledně odlišuj hodnocení učitele od vlastního pohledu žáka (sebehodnocení). Sebehodnocení je subjektivní pohled žáka, ne objektivní hodnocení. Případné rozdíly formuluj citlivě a věcně.
- Cíl se splněním „neoznačeno“ nikdy nepopisuj jako splněný ani nesplněný.
- Piš česky, srozumitelně pro žáka i rodiče, pozitivně a pedagogicky vhodně. Žáka neoslovuj jménem, piš genderově neutrálně (např. „zvládá“, „potřebuje“, „žák“).
- Hodnocení slouží ke zpětné vazbě a podpoře rozvoje, není to známka.
- Můžeš dostat výňatky ze ŠVP nebo tematických plánů školy – opři o ně návrhy cílů a dovedností. Můžeš dostat podpůrná opatření žáka (PLPP, IVP, doporučení PPP/SPC) – zohledni individuální potřeby a doporučenou podporu, ale neuváděj jména ani diagnózy.
- Odpověz výhradně platným JSON podle zadaného schématu, bez jakéhokoli dalšího textu.`

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

// Schéma odpovědi pro Gemini (responseSchema – typy velkými písmeny).
const SCHEMA: Record<string, Record<string, unknown>> = {
  cile: {
    type: 'OBJECT',
    properties: { goals: { type: 'ARRAY', items: { type: 'STRING' } } },
    required: ['goals'],
  },
  hodnoceni: {
    type: 'OBJECT',
    properties: { text: { type: 'STRING' }, missing: { type: 'ARRAY', items: { type: 'STRING' } } },
    required: ['text', 'missing'],
  },
  rozvoj: {
    type: 'OBJECT',
    properties: { s: { type: 'STRING' }, w: { type: 'STRING' }, o: { type: 'STRING' }, t: { type: 'STRING' } },
    required: ['s', 'w', 'o', 't'],
  },
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Použijte POST.' }, 405)
  if (!API_KEY) return json({ error: 'AI není nakonfigurovaná (chybí GEMINI_API_KEY).' }, 503)

  // Jen přihlášený učitel (anon key nestačí).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const { data: userData } = await admin.auth.getUser(token)
  const user = userData?.user
  if (!user) return json({ error: 'Pro návrhy AI se přihlaste.' }, 401)

  // Denní limit požadavků na učitele.
  const today = new Date().toISOString().slice(0, 10)
  const { data: usage } = await admin.from('ai_usage').select('calls').eq('teacher_id', user.id).eq('day', today).maybeSingle()
  if ((usage?.calls ?? 0) >= DAILY_LIMIT) return json({ error: `Denní limit ${DAILY_LIMIT} návrhů AI je vyčerpaný.` }, 429)
  await admin.from('ai_usage').upsert({ teacher_id: user.id, day: today, calls: (usage?.calls ?? 0) + 1 })

  let body: { task?: string; length?: string; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Neplatný JSON.' }, 400)
  }
  const task = body.task ?? ''
  if (!TASK_PROMPT[task]) return json({ error: 'Neznámý úkol.' }, 400)
  const ctxObj = (body.context ?? {}) as Record<string, unknown>
  const ids = (ctxObj._ids ?? {}) as { schoolId?: string | null; subjectId?: string | null; studentId?: string | null }
  delete ctxObj._ids
  const context = JSON.stringify(ctxObj)
  if (context.length > 60_000) return json({ error: 'Kontext je příliš velký.' }, 413)

  // Výňatky z nahraných dokumentů (nepovinné – když nejsou nebo nejdou přečíst, pokračuje se bez nich).
  let docSection = ''
  try {
    if (task === 'cile' && ids.schoolId) docSection = await schoolDocExcerpts(ids.schoolId, ids.subjectId ?? undefined)
    else if ((task === 'hodnoceni' || task === 'rozvoj') && ids.studentId) docSection = await studentDocExcerpts(ids.studentId)
  } catch (_e) {
    docSection = ''
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `${TASK_PROMPT[task](body.length)}${docSection}\n\nKontext hodnocení:\n${context}` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA[task],
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (res.status === 429) return json({ error: 'AI je přetížená nebo je vyčerpaný denní limit Google, zkuste to za chvíli.' }, 429)
      if (res.status === 400 && /API key|API_KEY_INVALID/i.test(detail)) return json({ error: 'Chybný klíč k AI (GEMINI_API_KEY).' }, 502)
      if (res.status === 404) return json({ error: `Model „${MODEL}“ není dostupný.` }, 502)
      return json({ error: `Chyba AI (${res.status}).` }, 502)
    }

    const data = await res.json()
    const cand = data.candidates?.[0]
    if (data.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY' || cand?.finishReason === 'PROHIBITED_CONTENT') {
      return json({ error: 'AI požadavek odmítla.' }, 422)
    }
    if (cand?.finishReason === 'MAX_TOKENS') return json({ error: 'Odpověď AI byla příliš dlouhá.' }, 502)
    const text: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
    if (!text.trim()) return json({ error: 'AI vrátila prázdnou odpověď.' }, 502)
    return json(JSON.parse(text))
  } catch (e) {
    if (e instanceof SyntaxError) return json({ error: 'AI vrátila neplatnou odpověď.' }, 502)
    return json({ error: 'Neočekávaná chyba.' }, 500)
  }
})
