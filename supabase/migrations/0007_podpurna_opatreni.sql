-- Dokumentace a podpůrná opatření žáka (rozšíření bodu 1 zadání).
-- Rozbalovací pole v 1. kroku hodnocení přidává další druhy podpůrných dokumentů
-- (zpráva ŠPZ, doporučení k podpůrným opatřením, úprava podmínek), vlastní název
-- u druhu „Další dokument" a evidenci „žák nemá podpůrná opatření".
--
-- Sloupec documents.kind je volný text, nové druhy (spz, podpurna, upravy) tedy
-- nevyžadují změnu schématu – přidáváme jen vlastní název dokumentu a příznak žáka.

-- Vlastní název u druhu „Další dokument" (kind = 'jine').
alter table documents add column if not exists title text;

-- Učitel výslovně označil, že žák nemá evidovaná podpůrná opatření
-- (odlišení od „zatím nevyplněno"); výchozí false.
alter table students add column if not exists no_support boolean not null default false;
