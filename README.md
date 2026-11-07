# Pokrok žáka

Webová aplikace pro ZŠ a SŠ **vytvořená pomocí claude**, která propojuje formativní hodnocení, SWOT analýzu a sledování individuálního pokroku žáků. Postavená podle zadání `formativní hodnocení.docx` a úprav v `pokrok_oprava.docx` a `dotaznik.docx`.

> Hlavní zásada: učitel hodnotí konkrétní dovednost, poskytuje zpětnou vazbu a stanovuje další cíl. Aplikace zaznamenává vývoj, ale nenahrazuje pedagogické rozhodnutí.

## Spuštění

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produkční build do dist/
```

Po otevření se ukáže úvodní stránka s tlačítkem „Vyzkoušet demo“ (přihlášení zatím není). Přehled učitele je na `#/prehled`.

Aplikace běží v **demo režimu**: obsahuje fiktivní třídy ZŠ (7.A) i SŠ (ME1) s ukázkovými záznamy za posledních 9 týdnů. Data se ukládají v prohlížeči (localStorage). Tlačítkem „Obnovit ukázková data“ vlevo dole se vrátí do výchozího stavu.

Vzhled jde přepnout vlevo dole: světlý, tmavý, nebo podle systému. Tisk a PDF jsou vždy světlé.

## Co aplikace umí

| Oblast | Kde v aplikaci |
|---|---|
| Třída, předmět, žáci (ručně i z Excelu), formulace dotazníku podle věku | **Třídy a žáci** (+ přepínač ZŠ/SŠ, třída, předmět v horní liště) |
| Co hodnotit: 7 základních oblastí + vlastní kritéria, banka vět | **Kritéria a věty** |
| Vzdělávací cíl hodiny, jeho splnění (splněno / částečně / nesplněno), návrh cíle z předchozích záznamů | **Nové hodnocení**, krok 2 |
| Výběr dovedností pro hodinu a hodnocení 1–5 (1 = nejnižší, 5 = nejvyšší, nevybráno = nehodnoceno) | **Nové hodnocení**, krok 3 |
| Slovní zpětná vazba (nepovinná) | **Nové hodnocení**, krok 4 |
| Sebehodnocení žáka: univerzální dotazník (6 otázek), QR / odkaz s platností 24 h, jednorázové odeslání, řízená oprava, porovnání s hodnocením učitele | **Nové hodnocení**, krok 5 → stránka pro žáka |
| SWOT, doporučení pro rozvoj a formativní hodnocení – automaticky z hodnocení, sebehodnocení a zpětné vazby, vše upravitelné | **Nové hodnocení**, krok 6 |
| Poslední hodnocení vedle nového, další cíl | **Nové hodnocení** (pravý sloupec, krok 7) |
| Žáci, kteří potřebují větší podporu; dosažené a nesplněné cíle | **Přehled** |
| Vývoj v čase (graf, zlepšení jde nahoru), historie sebehodnocení | **Žáci a pokrok** → detail žáka |
| Výsledky sebehodnocení podle třídy, předmětu a období (subjektivní pohled žáka) | **Sebehodnocení** |
| Týdenní / měsíční / pololetní souhrn, schválení, tisk / PDF | **Souhrny** |
| Export (xlsx, csv, záloha), přehled třídy, pohled vedení školy | **Export dat**, **Přehled třídy**, „Přihlášen jako → Vedení školy“ |

### Jak vznikají souhrny, SWOT a formativní hodnocení

Deterministicky, bez AI: `src/lib/analysis.ts` skládá věty jen z uložených úrovní, splnění cílů, zpětné vazby a sebehodnocení. Každá věta souhrnu nese odkazy na záznamy, ze kterých vznikla. Překážky (T) vycházejí jen z dat (opakovaně nízká úroveň, nesoulad sebehodnocení s hodnocením učitele, opakovaně nesplněný cíl, potíže, které uvedl sám žák), nikdy z domněnek o osobní situaci žáka. Tisknout jde jen schválená verze souhrnu.

### Změna škály (verze 0.0.5)

Do verze 0.0.4 platilo 1 = nejvyšší zvládnutí. Od 0.0.5 je 1 = nejnižší a 5 = nejvyšší. Uložená data se při prvním otevření převedou (`src/lib/migrate.ts`): úroveň = 6 − stará, přepočítají se i čísla ve větách souhrnů, které vytvořila aplikace. Věty a komentáře doplněné učitelem se nemění. Starší sebehodnocení (volné odpovědi) zůstávají a zobrazují se ve starém formátu. Rozvrh a číslo hodiny byly z aplikace odstraněny.

## Struktura

```
src/lib/types.ts      datový model
src/lib/store.ts      akce nad daty (demo: localStorage, místo pro Supabase)
src/lib/seed.ts       demo data (fiktivní žáci)
src/lib/levels.ts     škála 1–5
src/lib/analysis.ts   trendy, souhrny, SWOT, formativní hodnocení, doporučení, návrh cíle
src/lib/questionnaire.ts  univerzální sebehodnoticí dotazník
src/lib/migrate.ts    převod starších dat (obrácená škála)
src/lib/exporter.ts   export xlsx / csv
src/pages/*           obrazovky
supabase/migrations   schéma pro ostrý provoz (RLS, audit, sebehodnocení přes kód s platností, agregace pro vedení)
```

## Na ostrý provoz (zatím není hotové)

- Přepojit `store.ts` na Supabase (schéma je v `supabase/migrations/0001_init.sql`) a přidat přihlášení učitelů a přístupová oprávnění. Teprve pak sebehodnocení funguje z telefonu žáka a žák vidí jen své odpovědi i mezi zařízeními (v demu jsou data jen v jednom prohlížeči).
- Hosting v EU, RLS na všech tabulkách (připraveno ve schématu), audit log (triggery).
- PDF teď vzniká přes tiskový dialog prohlížeče („Uložit jako PDF“). Pro jednotný výstup lze později generovat na serveru.

## Soukromí

Aplikace nepoužívá cookies ani služby třetích stran. Písma (Figtree, Bricolage Grotesque, licence SIL OFL 1.1) jsou přibalená přes Fontsource, takže se nic nenačítá z Google Fonts. Nezbytná data se ukládají jen do localStorage v prohlížeči. Při první návštěvě se jednou zobrazí informační lišta, později je dostupná přes odkaz „Soukromí“. Pokud v budoucnu přibude něco volitelného (např. analytika), je potřeba vrátit volbu Přijmout / Odmítnout (viz `src/lib/privacy.ts`).

## Licence

MIT – viz soubor `LICENSE`.
