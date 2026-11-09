-- Katalog: společné dovednosti a ukázkové tematické celky ŠVP (generováno ze src/lib/catalog.ts).
insert into criteria (id, subject_id, name, question, archived) values
  ('k-znalosti', null, 'Porozumění učivu', 'Rozumí žák učivu a dokáže ho vysvětlit?', false),
  ('k-reseni', null, 'Řešení problémů', 'Dokáže učivo použít při řešení úloh?', false),
  ('k-samostatnost', null, 'Samostatnost', 'Zvládne pracovat bez pomoci?', false),
  ('k-spoluprace', null, 'Spolupráce', 'Dokáže pracovat s ostatními?', false),
  ('k-komunikace', null, 'Komunikace', 'Srozumitelně vyjadřuje své myšlenky a postupy?', false),
  ('k-organizace', null, 'Organizace práce', 'Plánuje si práci a dokončí ji včas?', false),
  ('k-tvorivost', null, 'Tvořivost', 'Přichází s vlastními nápady a řešeními?', false),
  ('k-kriticke', null, 'Kritické myšlení', 'Ověřuje informace a posuzuje výsledky?', false),
  ('k-digitalni', null, 'Digitální kompetence', 'Účelně a bezpečně používá digitální technologie?', false),
  ('k-zpetna-vazba', null, 'Práce se zpětnou vazbou', 'Využívá zpětnou vazbu ke zlepšení?', false),
  ('k-dovednosti', null, 'Dovednosti (starší)', 'Dokáže učivo použít?', true),
  ('k-ukoly', null, 'Plnění úkolů (starší)', 'Dokončí zadanou práci?', true),
  ('k-pokrok', null, 'Pokrok (starší)', 'Zlepšuje se?', true),
  ('k-sebehodnoceni', null, 'Sebehodnocení (starší)', 'Ví, co umí a co potřebuje zlepšit?', true)
on conflict (id) do update set name = excluded.name, question = excluded.question, archived = excluded.archived;

insert into topic_units (id, school_id, subject_name, grades, school_type, name, goals, custom, created_by) values
  ('svp-inf-1', null, 'informatika', array[1]::smallint[], 'SS', 'Základy práce s počítačem a operační systém', array['Žák se orientuje v operačním systému a spravuje soubory a složky.', 'Žák bezpečně ukládá a zálohuje svou práci.']::text[], false, null),
  ('svp-inf-2', null, 'informatika', array[1]::smallint[], 'SS', 'Tabulkový procesor', array['Žák vytvoří tabulku a použije funkce SUMA, PRŮMĚR, MIN a MAX.', 'Žák sestaví vzorec s odkazy na buňky a ověří jeho výsledek.', 'Žák vytvoří z dat vhodný graf s popisky.']::text[], false, null),
  ('svp-inf-3', null, 'informatika', array[1]::smallint[], 'SS', 'Textový editor a typografie', array['Žák upraví dokument podle typografických pravidel a použije styly.']::text[], false, null),
  ('svp-inf-4', null, 'informatika', array[1]::smallint[], 'SS', 'Prezentace informací', array['Žák připraví přehlednou prezentaci a srozumitelně ji přednese.']::text[], false, null),
  ('svp-inf-5', null, 'informatika', array[1, 2]::smallint[], 'SS', 'Algoritmizace a programování', array['Žák zapíše jednoduchý algoritmus a otestuje ho na příkladech.']::text[], false, null),
  ('svp-inf-6', null, 'informatika', array[1, 2]::smallint[], 'SS', 'Bezpečnost a etika na internetu', array['Žák rozpozná rizika na internetu a popíše, jak se chránit.']::text[], false, null),
  ('svp-mat-ss-1', null, 'matematika', array[1]::smallint[], 'SS', 'Číselné obory', array['Žák provádí početní operace v oboru reálných čísel a odhaduje výsledky.']::text[], false, null),
  ('svp-mat-ss-2', null, 'matematika', array[1]::smallint[], 'SS', 'Algebraické výrazy', array['Žák upravuje algebraické výrazy a rozkládá je na součin.']::text[], false, null),
  ('svp-mat-ss-3', null, 'matematika', array[1]::smallint[], 'SS', 'Lineární rovnice a nerovnice', array['Žák řeší lineární rovnice a ověří správnost řešení zkouškou.']::text[], false, null),
  ('svp-mat-ss-4', null, 'matematika', array[1, 2]::smallint[], 'SS', 'Funkce', array['Žák načrtne graf lineární funkce a popíše její vlastnosti.']::text[], false, null),
  ('svp-mat-7-1', null, 'matematika', array[7]::smallint[], 'ZS', 'Racionální čísla – zlomky', array['Žák krátí a rozšiřuje zlomky a převádí je na základní tvar.', 'Žák sčítá a odčítá zlomky s různým jmenovatelem.', 'Žák řeší slovní úlohy se zlomky a zapíše odpověď.']::text[], false, null),
  ('svp-mat-7-2', null, 'matematika', array[7]::smallint[], 'ZS', 'Desetinná čísla', array['Žák převádí zlomky na desetinná čísla a porovnává je.']::text[], false, null),
  ('svp-mat-7-3', null, 'matematika', array[7]::smallint[], 'ZS', 'Poměr a přímá úměrnost', array['Žák řeší úlohy s poměrem a přímou úměrností.']::text[], false, null),
  ('svp-mat-7-4', null, 'matematika', array[7]::smallint[], 'ZS', 'Procenta', array['Žák vypočítá procentovou část, základ i počet procent.']::text[], false, null),
  ('svp-mat-7-5', null, 'matematika', array[7]::smallint[], 'ZS', 'Trojúhelníky a čtyřúhelníky', array['Žák narýsuje trojúhelník a čtyřúhelník podle zadání.']::text[], false, null),
  ('svp-cj-7-1', null, 'český jazyk', array[7]::smallint[], 'ZS', 'Tvarosloví – slovní druhy', array['Žák určí slovní druhy a mluvnické kategorie ve větě.']::text[], false, null),
  ('svp-cj-7-2', null, 'český jazyk', array[7]::smallint[], 'ZS', 'Skladba – věta jednoduchá', array['Žák určí základní a rozvíjející větné členy.']::text[], false, null),
  ('svp-cj-7-3', null, 'český jazyk', array[7]::smallint[], 'ZS', 'Pravopis', array['Žák správně píše i/y po obojetných souhláskách a zdůvodní pravopis.']::text[], false, null),
  ('svp-cj-7-4', null, 'český jazyk', array[7]::smallint[], 'ZS', 'Sloh – popis a charakteristika', array['Žák napíše souvislý popis s vhodnou stavbou a jazykovými prostředky.']::text[], false, null),
  ('svp-cj-7-5', null, 'český jazyk', array[7]::smallint[], 'ZS', 'Literatura – pověsti a báje', array['Žák převypráví pověst a určí její znaky.']::text[], false, null)
on conflict (id) do update set name = excluded.name, goals = excluded.goals, grades = excluded.grades;
