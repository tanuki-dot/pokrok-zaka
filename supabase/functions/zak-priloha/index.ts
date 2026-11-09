// Supabase Edge Function: žák přiloží svou práci k sebehodnocení.
// Žák nemá účet – nahrát smí jen s platným kódem z QR / odkazu, a jen k tomu jednomu hodnocení.
//
// Nasazení: supabase functions deploy zak-priloha --no-verify-jwt
// (volá se bez přihlášení; ověřuje se kód, ne uživatel)

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 10
const ALLOWED = /^(image\/|application\/pdf$|application\/msword$|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.oasis\.opendocument\.|application\/vnd\.ms-|text\/plain$|application\/rtf$)/

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Použijte POST.' }, 405)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'Neplatný požadavek.' }, 400)
  }
  const code = String(form.get('code') ?? '').toUpperCase().trim()
  const file = form.get('file')
  if (!/^[A-Z2-9]{6}$/.test(code) || !(file instanceof File)) return json({ error: 'Chybí kód nebo soubor.' }, 400)
  if (file.size > MAX_BYTES) return json({ error: 'Soubor je větší než 10 MB.' }, 413)
  if (!ALLOWED.test(file.type)) return json({ error: 'Tento typ souboru nejde přiložit.' }, 415)

  const { data: a } = await admin.from('assessments').select('id, self_code_expires').eq('self_code', code).maybeSingle()
  if (!a || (a.self_code_expires && new Date(a.self_code_expires) < new Date())) return json({ error: 'Kód neplatí nebo vypršel.' }, 403)

  const { count } = await admin.from('attachments').select('id', { count: 'exact', head: true }).eq('assessment_id', a.id).eq('owner', 'zak')
  if ((count ?? 0) >= MAX_FILES) return json({ error: `Najednou jde přiložit nejvýše ${MAX_FILES} souborů.` }, 409)

  const id = 'f' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const name = file.name.slice(0, 200)
  const up = await admin.storage.from('prilohy').upload(`${a.id}/${id}`, file, { contentType: file.type, upsert: false })
  if (up.error) return json({ error: 'Soubor se nepodařilo uložit.' }, 500)
  const ins = await admin.from('attachments').insert({ id, assessment_id: a.id, owner: 'zak', name, type: file.type, size: file.size })
  if (ins.error) {
    await admin.storage.from('prilohy').remove([`${a.id}/${id}`])
    return json({ error: 'Soubor se nepodařilo uložit.' }, 500)
  }
  return json({ id, name, size: file.size, type: file.type, assessmentId: a.id })
})
