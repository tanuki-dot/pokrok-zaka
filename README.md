# Pokrok žáka

Webová aplikace pro ZŠ a SŠ, která propojuje formativní hodnocení, SWOT analýzu a sledování individuálního pokroku žáků. Postavená podle zadání `formativní hodnocení.docx`.

> Hlavní zásada: učitel hodnotí konkrétní dovednost, poskytuje zpětnou vazbu a stanovuje další cíl. Aplikace zaznamenává vývoj, ale nenahrazuje pedagogické rozhodnutí.

## Spuštění

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produkční build do dist/
```

Aplikace běží v **demo režimu**: obsahuje fiktivní třídy ZŠ (7.A) i SŠ (ME1) s ukázkovými záznamy za posledních 9 týdnů. Data se ukládají v prohlížeči (localStorage). Tlačítkem „Obnovit ukázková data“ vlevo dole se vrátí do výchozího stavu.

## Co aplikace umí (podle kroků v zadání)

| Krok | Kde v aplikaci |
|---|---|
| 1 – Třída, předmět, žáci (ručně i z Excelu) | **Třídy a žáci** (+ přepínač ZŠ/SŠ, třída, předmět v horní liště) |
| 2 – Co hodnotit: 7 základních oblastí + vlastní kritéria | **Kritéria a věty** |
| 3 – Hodnocení 1–5 jedním kliknutím | **Nové hodnocení**, krok 3 |
| 4 – Tři otázky zpětné vazby + banka vět | **Nové hodnocení**, krok 4 / **Kritéria a věty** |
| 5 – Sebehodnocení žáka (odkaz / QR, jednorázový kód, bez účtu) | **Nové hodnocení**, krok 5 → stránka pro žáka |
| 6 – SWOT, návrh z hodnocení, překážky jen ověřené | **Nové hodnocení**, krok 6 |
| 7 – Uložení, pozdější oprava, další cíl | **Nové hodnocení**, krok 7 / časová osa v detailu žáka |
| 8 – Změny v čase, graf (obrácená osa: 1 = nahoře) | **Žáci a pokrok** → detail žáka |
| 9 – Týdenní / měsíční / pololetní souhrn | **Souhrny** |
| 10 – Kontrola, schválení, tisk / PDF, export | **Souhrny** → schválit → Tisk / PDF; **Export dat** (xlsx, csv, záloha) |
| Přehled třídy a vedení školy | **Přehled třídy**; přepnout „Přihlášen jako → Vedení školy“ |

### Jak vznikají souhrny a návrhy SWOT

Deterministicky, bez AI: `src/lib/analysis.ts` skládá věty jen z uložených úrovní, zpětné vazby, cílů a sebehodnocení. Každá věta nese odkazy na záznamy, ze kterých vznikla (v editoru jsou vidět a jde na ně kliknout). Překážky (T) se nikdy nevyplňují automaticky. Tisknout jde jen schválená verze; úprava schváleného souhrnu založí novou verzi.

## Struktura

```
src/lib/types.ts      datový model
src/lib/store.ts      akce nad daty (demo: localStorage, místo pro Supabase)
src/lib/seed.ts       demo data (fiktivní žáci)
src/lib/analysis.ts   trendy, souhrny, návrh SWOT
src/lib/exporter.ts   export xlsx / csv
src/pages/*           obrazovky
supabase/migrations   schéma pro ostrý provoz (RLS, audit, sebehodnocení přes kód, agregace pro vedení)
```

## Na ostrý provoz (zatím není hotové)

- Přepojit `store.ts` na Supabase (schéma je v `supabase/migrations/0001_init.sql`) a přidat přihlášení učitelů.
- Hosting v EU, RLS na všech tabulkách (připraveno ve schématu), audit log (triggery).
- PDF teď vzniká přes tiskový dialog prohlížeče („Uložit jako PDF“). Pro jednotný výstup lze později generovat na serveru.

## Licence

MIT – viz soubor `LICENSE`.
