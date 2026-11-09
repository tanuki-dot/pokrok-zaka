-- Pokrok žáka – databáze pro Supabase (hosting v EU).
-- Struktura odpovídá datovému modelu aplikace (src/lib/types.ts): identifikátory jsou texty
-- vytvořené aplikací, vnořené části hodnocení (cíle, úrovně, dotazník, zpráva) jsou JSONB.
--
-- Bezpečnost (RLS na všech tabulkách):
--   učitel vidí a mění jen třídy, které učí (class_teachers; tvůrce třídy se přidá automaticky),
--   žák nemá účet – k dotazníku se dostane jen přes platný jednorázový kód (funkce níže),
--   vedení školy vidí jen souhrnná čísla (management_stats), žádná jména ani hodnocení žáků.

-- ─── Profil učitele ──────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  role text not null default 'ucitel' check (role in ('ucitel', 'vedeni')),
  school_id text,                                -- u vedení: škola, za kterou vidí souhrny
  created_at timestamptz not null default now()
);

-- Profil se založí automaticky při registraci.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ─── Školy, třídy, žáci, předměty ────────────────────────────────────────────

create table schools (
  id text primary key,
  name text not null,
  type text not null check (type in ('ZS', 'SS')),
  created_by uuid not null default auth.uid() references auth.users on delete cascade
);

create table classes (
  id text primary key,
  school_id text not null references schools on delete cascade,
  name text not null,
  grade smallint,
  field text,
  self_wording text not null default 'standard' check (self_wording in ('standard', 'mladsi')),
  created_by uuid not null default auth.uid() references auth.users on delete cascade
);

create table class_teachers (
  class_id text references classes on delete cascade,
  teacher_id uuid references auth.users on delete cascade,
  primary key (class_id, teacher_id)
);

-- Tvůrce třídy ji automaticky učí.
create or replace function add_class_creator() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into class_teachers (class_id, teacher_id) values (new.id, new.created_by) on conflict do nothing;
  return new;
end $$;
create trigger on_class_created after insert on classes for each row execute function add_class_creator();

create table students (
  id text primary key,
  class_id text not null references classes on delete cascade,
  first_name text not null,
  last_name text not null
);

create table subjects (
  id text primary key,
  class_id text not null references classes on delete cascade,
  name text not null,
  hidden_defaults text[] not null default '{}'
);

-- Dovednosti: subject_id null = společné pro všechny předměty (katalog), jinak vlastní dovednost předmětu.
create table criteria (
  id text primary key,
  subject_id text references subjects on delete cascade,
  name text not null,
  question text not null default '',
  archived boolean not null default false
);

-- Tematické celky ŠVP: school_id null = ukázkový katalog, jinak vlastní celky školy/učitele.
create table topic_units (
  id text primary key,
  school_id text references schools on delete cascade,
  subject_name text not null,
  grades smallint[] not null default '{}',
  school_type text check (school_type in ('ZS', 'SS')),
  name text not null,
  goals text[] not null default '{}',
  custom boolean not null default false,
  created_by uuid default auth.uid() references auth.users on delete cascade
);

-- ─── Hodnocení ───────────────────────────────────────────────────────────────

create table assessments (
  id text primary key,
  student_id text not null references students on delete cascade,
  subject_id text not null references subjects on delete cascade,
  teacher_id uuid not null default auth.uid() references auth.users,
  date date not null,
  period_type text not null check (period_type in ('hodina', 'tyden', 'mesic', 'pololeti', 'rok', 'vlastni')),
  period_from date not null,
  period_to date not null check (period_to >= period_from),
  units text[] not null default '{}',
  topic text not null default '',
  goals jsonb not null default '[]',          -- [{id, text, status: splneno|castecne|nesplneno|null}]
  skills text[] not null default '{}',
  scores jsonb not null default '{}',         -- {criterionId: 1–5}; 1 = výborně … 5 = zatím nezvládá; chybí = nehodnoceno
  skill_notes jsonb not null default '{}',
  teacher_q jsonb not null default '{}',      -- dotazník učitele podle období
  feedback jsonb not null default '{}',
  swot jsonb not null default '{}',           -- individuální rozvoj žáka (4 pole)
  report jsonb,                               -- formativní zpráva (délka, text, původní návrh, schválení, přílohy)
  next_goal text not null default '',
  self_form jsonb,                            -- dotazník pro žáka upravený učitelem
  status text not null default 'rozpracovane' check (status in ('rozpracovane', 'dokoncene')),
  self_code text unique,                      -- jednorázový kód pro sebehodnocení (QR / odkaz)
  self_code_expires timestamptz,
  self_code_correction boolean not null default false,
  scores_original jsonb,                      -- původní hodnoty u převedených záznamů
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table self_assessments (
  id text primary key,
  assessment_id text not null unique references assessments on delete cascade,
  answers jsonb,                              -- odpovědi žáka (subjektivní pohled, nepřevádí se na známku)
  form jsonb,                                 -- znění dotazníku, na který žák odpovídal
  legacy jsonb,                               -- starší podoba (volné odpovědi)
  submitted_at timestamptz not null default now(),
  corrections smallint not null default 0
);

create table attachments (
  id text primary key,
  assessment_id text not null references assessments on delete cascade,
  owner text not null check (owner in ('ucitel', 'zak')),
  name text not null,
  type text not null,
  size integer not null check (size <= 10485760),
  added_at timestamptz not null default now()
);

create table goals (
  id text primary key,
  student_id text not null references students on delete cascade,
  subject_id text not null references subjects on delete cascade,
  assessment_id text references assessments on delete set null,
  text text not null,
  set_on date not null,
  due date not null,
  status text not null default 'rozpracovany' check (status in ('rozpracovany', 'splneny', 'nesplneny'))
);

create table summaries (
  id text primary key,
  student_id text not null references students on delete cascade,
  subject_id text not null references subjects on delete cascade,
  kind text not null check (kind in ('tyden', 'mesic', 'pololeti', 'rok', 'vlastni')),
  period_from date not null,
  period_to date not null,
  sections jsonb not null default '[]',
  sections_original jsonb,
  teacher_note text not null default '',
  status text not null default 'navrh' check (status in ('navrh', 'schvaleno')),
  version integer not null default 1,
  history jsonb not null default '[]',
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table phrases (
  id text primary key,
  teacher_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('good', 'todo', 'next')),
  text text not null
);

-- Historie změn (kdo co kdy změnil) – zapisuje aplikace, číst ji smí jen autor.
create table audit_log (
  id text primary key,
  at timestamptz not null default now(),
  actor uuid not null default auth.uid() references auth.users on delete cascade,
  action text not null,
  entity text not null,
  label text not null default ''
);

-- Omezení použití AI (počet požadavků na učitele a den) – zapisuje jen serverová funkce.
create table ai_usage (
  teacher_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  calls integer not null default 0,
  primary key (teacher_id, day)
);

create index on students (class_id);
create index on subjects (class_id);
create index on assessments (student_id);
create index on assessments (subject_id);
create index on goals (student_id);
create index on summaries (student_id);
create index on attachments (assessment_id);

-- ─── Oprávnění (RLS) ─────────────────────────────────────────────────────────

create or replace function teaches(c text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_teachers where class_id = c and teacher_id = auth.uid())
$$;
create or replace function teaches_student(s text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from students st join class_teachers ct on ct.class_id = st.class_id where st.id = s and ct.teacher_id = auth.uid())
$$;
create or replace function teaches_subject(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from subjects sb join class_teachers ct on ct.class_id = sb.class_id where sb.id = p and ct.teacher_id = auth.uid())
$$;
create or replace function owns_assessment(a text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from assessments x where x.id = a and teaches_student(x.student_id))
$$;

alter table profiles enable row level security;
alter table schools enable row level security;
alter table classes enable row level security;
alter table class_teachers enable row level security;
alter table students enable row level security;
alter table subjects enable row level security;
alter table criteria enable row level security;
alter table topic_units enable row level security;
alter table assessments enable row level security;
alter table self_assessments enable row level security;
alter table attachments enable row level security;
alter table goals enable row level security;
alter table summaries enable row level security;
alter table phrases enable row level security;
alter table audit_log enable row level security;
alter table ai_usage enable row level security;

create policy profile_own on profiles for select using (id = auth.uid());
-- Učitel si smí změnit jméno, ne roli ani školu (ty nastavuje správce).
create or replace function my_role() returns text language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() $$;
create or replace function my_school() returns text language sql stable security definer set search_path = public as $$ select school_id from profiles where id = auth.uid() $$;
create policy profile_update on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = my_role() and school_id is not distinct from my_school());

create policy schools_read on schools for select using (created_by = auth.uid() or id = my_school() or exists (select 1 from classes c where c.school_id = schools.id and teaches(c.id)));
create policy schools_write on schools for all using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy classes_read on classes for select using (teaches(id) or created_by = auth.uid());
create policy classes_insert on classes for insert with check (created_by = auth.uid() and exists (select 1 from schools s where s.id = school_id and s.created_by = auth.uid()));
create policy classes_update on classes for update using (teaches(id)) with check (teaches(id));
create policy classes_delete on classes for delete using (created_by = auth.uid());

create policy class_teachers_read on class_teachers for select using (teacher_id = auth.uid());

create policy students_all on students for all using (teaches(class_id)) with check (teaches(class_id));
create policy subjects_all on subjects for all using (teaches(class_id)) with check (teaches(class_id));

create policy criteria_read on criteria for select using (subject_id is null or teaches_subject(subject_id));
create policy criteria_write on criteria for all using (subject_id is not null and teaches_subject(subject_id)) with check (subject_id is not null and teaches_subject(subject_id));

create policy units_read on topic_units for select using ((school_id is null and not custom) or created_by = auth.uid() or (school_id is not null and exists (select 1 from classes c where c.school_id = topic_units.school_id and teaches(c.id))));
create policy units_write on topic_units for all using (created_by = auth.uid() and custom) with check (created_by = auth.uid() and custom);

create policy assessments_all on assessments for all using (teaches_student(student_id)) with check (teaches_student(student_id) and teaches_subject(subject_id));
create policy self_read on self_assessments for select using (owns_assessment(assessment_id));
create policy self_write on self_assessments for all using (owns_assessment(assessment_id)) with check (owns_assessment(assessment_id));
create policy attachments_all on attachments for all using (owns_assessment(assessment_id)) with check (owns_assessment(assessment_id));
create policy goals_all on goals for all using (teaches_student(student_id)) with check (teaches_student(student_id));
create policy summaries_all on summaries for all using (teaches_student(student_id)) with check (teaches_student(student_id));
create policy phrases_all on phrases for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy audit_read on audit_log for select using (actor = auth.uid());
create policy audit_insert on audit_log for insert with check (actor = auth.uid());
-- ai_usage: bez politik → přístup jen pro serverovou funkci (service role).

-- ─── Přílohy v úložišti (bucket „prilohy“, cesta <assessment_id>/<attachment_id>) ──

insert into storage.buckets (id, name, public, file_size_limit)
values ('prilohy', 'prilohy', false, 10485760)
on conflict (id) do nothing;

create policy prilohy_read on storage.objects for select to authenticated
  using (bucket_id = 'prilohy' and owns_assessment(split_part(name, '/', 1)));
create policy prilohy_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'prilohy' and owns_assessment(split_part(name, '/', 1)));
create policy prilohy_delete on storage.objects for delete to authenticated
  using (bucket_id = 'prilohy' and owns_assessment(split_part(name, '/', 1)));
-- Žák nahrává přes serverovou funkci zak-priloha (ověří kód), přímý přístup nemá.

-- ─── Sebehodnocení žáka bez účtu (jen přes platný kód) ───────────────────────

-- Údaje pro dotazník: jen to, co žák smí vidět (své jméno, třída, předmět, období, cíle).
create or replace function self_form_for_code(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare a assessments; r jsonb; prev self_assessments;
begin
  select * into a from assessments where self_code = upper(p_code);
  if a.id is null then return jsonb_build_object('error', 'neplatny'); end if;
  if a.self_code_expires is not null and a.self_code_expires < now() then return jsonb_build_object('error', 'vyprsel'); end if;
  select * into prev from self_assessments where assessment_id = a.id;
  if prev.id is not null and not a.self_code_correction then return jsonb_build_object('error', 'odeslano'); end if;
  select jsonb_build_object(
    'assessment', jsonb_build_object('id', a.id, 'date', a.date, 'periodType', a.period_type, 'periodFrom', a.period_from, 'periodTo', a.period_to, 'goals', a.goals, 'selfForm', a.self_form),
    'student', jsonb_build_object('firstName', st.first_name, 'lastName', st.last_name),
    'class', jsonb_build_object('name', c.name, 'selfWording', c.self_wording),
    'subject', jsonb_build_object('name', sb.name),
    'correction', a.self_code_correction,
    'previous', case when a.self_code_correction then prev.answers else null end,
    'attachments', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'size', x.size)) from attachments x where x.assessment_id = a.id and x.owner = 'zak'), '[]')
  ) into r
  from students st join classes c on c.id = st.class_id join subjects sb on sb.id = a.subject_id
  where st.id = a.student_id;
  return r;
end $$;

-- Uložení odpovědí: kód musí platit, je jednorázový (po odeslání zanikne), oprava jen s kódem pro opravu.
create or replace function submit_self_assessment(p_code text, p_answers jsonb, p_form jsonb) returns boolean language plpgsql security definer set search_path = public as $$
declare a assessments; existing self_assessments;
begin
  select * into a from assessments where self_code = upper(p_code) and (self_code_expires is null or self_code_expires > now()) for update;
  if a.id is null then return false; end if;
  select * into existing from self_assessments where assessment_id = a.id;
  if existing.id is not null and not a.self_code_correction then return false; end if;
  if jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 20000 then return false; end if;
  update assessments set self_code = null, self_code_expires = null, self_code_correction = false, updated_at = now() where id = a.id;
  insert into self_assessments (id, assessment_id, answers, form, submitted_at, corrections)
  values ('z' || replace(gen_random_uuid()::text, '-', ''), a.id, p_answers, p_form, now(), 0)
  on conflict (assessment_id) do update set answers = excluded.answers, form = excluded.form, legacy = null,
    submitted_at = now(), corrections = self_assessments.corrections + 1;
  return true;
end $$;

revoke all on function self_form_for_code(text) from public;
revoke all on function submit_self_assessment(text, jsonb, jsonb) from public;
grant execute on function self_form_for_code(text) to anon, authenticated;
grant execute on function submit_self_assessment(text, jsonb, jsonb) to anon, authenticated;

-- ─── Vedení školy: jen souhrnná čísla, žádná jména ani hodnocení žáků ────────

create or replace function management_stats(p_from date, p_to date)
returns table (class_name text, school_type text, subject_name text, records bigint, with_feedback bigint, goals bigint, goals_done bigint, self_assessed bigint, approved_summaries bigint, pupils bigint, reached bigint)
language sql stable security definer set search_path = public as $$
  select c.name, s.type, sub.name,
    count(distinct a.id),
    count(distinct a.id) filter (where coalesce(a.feedback->>'good', '') <> '' and coalesce(a.feedback->>'next', '') <> ''),
    (select count(*) from goals g where g.subject_id = sub.id and g.set_on between p_from and p_to),
    (select count(*) from goals g where g.subject_id = sub.id and g.set_on between p_from and p_to and g.status = 'splneny'),
    count(distinct sa.id),
    (select count(*) from summaries x where x.subject_id = sub.id and x.status = 'schvaleno' and x.period_to between p_from and p_to),
    (select count(*) from students st where st.class_id = c.id),
    count(distinct a.student_id)
  from subjects sub
  join classes c on c.id = sub.class_id
  join schools s on s.id = c.school_id
  left join assessments a on a.subject_id = sub.id and a.date between p_from and p_to
  left join self_assessments sa on sa.assessment_id = a.id
  where c.school_id = (select school_id from profiles where id = auth.uid() and role = 'vedeni')
  group by c.id, c.name, s.type, sub.id, sub.name
$$;
revoke all on function management_stats(date, date) from public;
grant execute on function management_stats(date, date) to authenticated;
