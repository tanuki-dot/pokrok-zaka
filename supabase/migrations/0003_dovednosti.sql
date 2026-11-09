-- Rozšíření společných hodnocených dovedností na 18 (zadání, bod 2).
-- Nové dovednosti do sdíleného katalogu (subject_id = null) + sladění 2 názvů
-- s názvoslovím zadání. Idempotentní – lze pustit opakovaně.

insert into criteria (id, subject_id, name, question) values
  ('k-aktivita',     null, 'Aktivita',            'Zapojuje se aktivně do výuky?'),
  ('k-zodpovednost', null, 'Zodpovědnost',        'Plní povinnosti a nese odpovědnost za svou práci?'),
  ('k-chyba',        null, 'Práce s chybou',      'Dokáže najít chybu a poučit se z ní?'),
  ('k-sebereflexe',  null, 'Sebehodnocení',       'Ví, co umí a co potřebuje zlepšit?'),
  ('k-vytrvalost',   null, 'Vytrvalost',          'Nevzdává se při obtížích a dotáhne práci do konce?'),
  ('k-informace',    null, 'Práce s informacemi', 'Vyhledá, posoudí a zpracuje informace?'),
  ('k-prezentace',   null, 'Prezentace výsledků', 'Srozumitelně představí výsledky své práce?'),
  ('k-pravidla',     null, 'Dodržování pravidel', 'Dodržuje dohodnutá pravidla a pokyny?')
on conflict (id) do nothing;

update criteria set name = 'Využívání zpětné vazby' where id = 'k-zpetna-vazba';
update criteria set name = 'Digitální dovednosti'   where id = 'k-digitalni';
