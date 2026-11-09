# Pokrok žáka

Webová aplikace pro ZŠ a SŠ **vytvořená pomocí claude**, která propojuje formativní hodnocení, individuální rozvoj žáka a sledování individuálního pokroku. Postavená podle zadání `formativní hodnocení.docx` a úprav v `pokrok_oprava.docx`, `dotaznik.docx` a `pokrokveskole.docx`.

> Hlavní zásada: učitel hodnotí konkrétní dovednost, poskytuje zpětnou vazbu a stanovuje další cíl. Aplikace zaznamenává vývoj, ale nenahrazuje pedagogické rozhodnutí.

## Spuštění

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produkční build do dist/
```

Bez nastavení serveru běží aplikace v **demo režimu**: úvodní stránka má tlačítko „Vyzkoušet demo“, přehled učitele je na `#/prehled` a aplikace obsahuje fiktivní třídy ZŠ (7.A) i SŠ (ME1) s ukázkovými záznamy za posledních 9 týdnů. Data se ukládají v prohlížeči (localStorage). Tlačítkem „Obnovit ukázková data“ vlevo dole se vrátí do výchozího stavu.

Vzhled jde přepnout vlevo dole: světlý, tmavý, nebo podle systému. Tisk a PDF jsou vždy světlé.

## Co aplikace umí (podle pokrokveskole.docx)

| Snímek | Kde v aplikaci |
|---|---|
| 1 – Úvodní stránka: počty hodnocení a hodnocených žáků, poslední hodnocení, nedokončená hodnocení, postup, tlačítka Nový žák / Nové hodnocení / Historie | **Přehled** |
| 2 – Údaje o žákovi: povinná pole, hodnocené období (hodina, týden, měsíc, pololetí, rok, vlastní), tematické celky ŠVP (více, i vlastní), více vzdělávacích cílů, připravené cíle a návrh cílů | **Nové hodnocení** → krok 1 |
| 3 – Hodnocení učitele: 10 dovedností + vlastní, škála 1–5 se slovním vysvětlením a komentářem, dotazník učitele podle období, splnění každého cíle, přílohy | krok 2 |
| 4 – Sebehodnocení žáka: QR kód / odkaz, otázky podle období, poznámky k otázkám, přílohy žáka, úprava dotazníku učitelem, porovnání s hodnocením učitele | krok 3 → stránka pro žáka |
| 5 – Formativní hodnocení: zpráva pro žáka a rodiče (krátká / střední / dlouhá), vytvoření návrhu, vrácení původního návrhu, schválení, individuální rozvoj ve 4 barevných polích, výběr příloh, kopírování, tisk / PDF | krok 4 |
| 6 – Historie a pokrok: vyhledávání a filtry, grafy (dovednosti, porovnání v čase, cíle, samostatnost, učitel × žák), souhrny za týden až rok i vlastní období, portfolio příloh, export do PDF s grafy a přílohami | **Historie hodnocení**, **Žáci a pokrok**, **Souhrny**, **Portfolio a přílohy** |
| 7 – Navigace mezi kroky s vybraným žákem a předmětem, ukládání rozpracovaných hodnocení, upozornění na neuložené změny, zachování starších záznamů | celý průvodce hodnocením |

### Škála (verze 0.0.6)

**1 = výborně, 2 = velmi dobře, 3 = částečně zvládá, 4 = potřebuje výraznou pomoc, 5 = zatím nezvládá.** Nevybraná dovednost = nehodnoceno a nezapočítává se do souhrnů ani grafů. Data ze starších verzí se při prvním otevření převedou podle významu (`src/lib/migrate.ts`): z verze 0.0.5 (1 = nejnižší) jako 6 − hodnota, verze 0.0.4 už měla stejný směr. Původní hodnoty zůstávají u každého záznamu (`scoresOriginal`), původní znění souhrnů v `sectionsOriginal`. Dovednosti ze starších verzí jsou archivované – zůstávají v historii, pro nová hodnocení se nenabízí.

### AI

Návrh cílů, slovní formativní hodnocení a individuální rozvoj umí vytvořit AI (Google Gemini, výchozí model `gemini-3.1-flash-lite` z bezplatné úrovně) přes serverovou funkci `supabase/functions/ai-navrh`. API klíč je jen na serveru, funkci smí volat jen přihlášený učitel (denní limit `AI_DAILY_LIMIT`, výchozí 60 návrhů) a aplikace posílá údaje bez jména a třídy žáka. Bez serveru se použijí šablony (`src/lib/analysis.ts`) se stejnými pravidly: vychází jen z uložených údajů, odlišuje hodnocení učitele od pohledu žáka, chybějící údaje nevydává za splněné ani nesplněné a upozorní na ně.

## Server (Supabase + GitHub Pages)

S nastaveným Supabase se učitel přihlašuje e-mailem a heslem, data jsou v databázi (RLS – každý učitel vidí jen své třídy), přílohy v úložišti Supabase Storage, žák vyplňuje sebehodnocení z mobilu přes kód (bez účtu) a vedení školy vidí jen souhrnná čísla. Webová aplikace běží na GitHub Pages.

Zatím je to **zkušební provoz jen s fiktivními žáky** – po prvním přihlášení zvolte „Nahrát ukázková data“.

```bash
supabase login
supabase link --project-ref <ref>          # projekt v EU (Frankfurt)
supabase db push                           # schéma, RLS, katalog dovedností a celků ŠVP
supabase config push                       # přihlášení: adresa webu, potvrzení e-mailu, délka hesla
supabase secrets set GEMINI_API_KEY=...    # klíč z Google AI Studio, zadejte sami, nikam jinam ho nedávejte
supabase functions deploy ai-navrh
supabase functions deploy zak-priloha --no-verify-jwt
```

Na GitHubu nastavte proměnné repozitáře `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` (obě jsou veřejné) a v Settings → Pages zdroj „GitHub Actions“. Workflow `.github/workflows/pages.yml` pak po každém pushi do `main` aplikaci sestaví a nasadí. Lokálně stačí soubor `.env.local` podle `.env.example`.

Účet vedení školy: v tabulce `profiles` nastavte `role = 'vedeni'` a `school_id` (SQL editor Supabase).

## Struktura

```
src/lib/types.ts      datový model
src/lib/store.ts      akce nad daty (demo: localStorage, se serverem zápis změn do Supabase)
src/lib/remote.ts     Supabase: načtení dat, zápis změn, přílohy, sebehodnocení přes kód
src/lib/session.ts    přihlášení učitele
src/lib/seed.ts       demo data (fiktivní žáci)
src/lib/levels.ts     škála 1–5 (1 = výborně)
src/lib/periods.ts    hodnocená období, dotazník učitele podle období
src/lib/catalog.ts    dovednosti, ukázkový katalog tematických celků ŠVP
src/lib/files.ts      přílohy (Supabase Storage, v demu IndexedDB)
src/lib/ai.ts         návrhy pomocí AI (server), jinak šablony
src/pages/eval/*      průvodce hodnocením (4 kroky)
src/lib/analysis.ts   souhrny, formativní zpráva, individuální rozvoj, doporučení, návrh cílů (šablony)
src/lib/questionnaire.ts  sebehodnocení žáka podle období
src/lib/migrate.ts    převod starších dat (obrácená škála)
src/lib/exporter.ts   export xlsx / csv
src/pages/*           obrazovky
supabase/migrations   schéma pro ostrý provoz (RLS, audit, období, cíle, přílohy, sebehodnocení přes kód s platností)
supabase/functions    ai-navrh (AI), zak-priloha (nahrání práce žáka přes kód)
```

## Na ostrý provoz se skutečnými žáky (zatím není hotové)

Dokud nejsou splněné tyto podmínky, zadávejte jen fiktivní údaje:
- Ochrana osobních údajů podle GDPR: záznam o zpracování, posouzení vlivu, smlouvy se zpracovateli (Supabase, při zapnutí AI i Google), informace pro rodiče.
- Správa účtů školou (pozvánky místo volné registrace), zálohy databáze, kontrola RLS politik.

## Soukromí

Aplikace nepoužívá cookies ani reklamní či analytické služby; bez nastavené AI ani žádné služby třetích stran. Písma (Figtree, Bricolage Grotesque, licence SIL OFL 1.1) jsou přibalená přes Fontsource, takže se nic nenačítá z Google Fonts. V demu se data ukládají jen v prohlížeči (localStorage, přílohy v IndexedDB), se serverem v databázi Supabase. Záloha `.json` obsahuje data, ne soubory příloh. Při první návštěvě se jednou zobrazí informační lišta, později je dostupná přes odkaz „Soukromí“. Pokud v budoucnu přibude něco volitelného (např. analytika), je potřeba vrátit volbu Přijmout / Odmítnout (viz `src/lib/privacy.ts`).

## Licence

MIT – viz soubor `LICENSE`.
