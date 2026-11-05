-- Pokrok žáka – schéma pro ostrý provoz (Supabase / Postgres, hosting v EU).
-- Odpovídá typům v src/lib/types.ts. Demo verze aplikace zatím běží nad localStorage
-- (src/lib/store.ts); při přechodu se vymění jen těla funkcí ve store.ts.
--
-- Role:  učitel  – vidí a upravuje jen třídy, které učí (class_teachers)
--        vedení  – vidí jen agregovaná čísla přes view management_stats, žádné žáky

create extension if not exists pgcrypto;

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('ZS', 'SS'))
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  school_id uuid not null references schools,
  full_name text not null,
  role text not null default 'ucitel' check (role in ('ucitel', 'vedeni'))
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools,
  name text not null
);

create table class_teachers (
  class_id uuid references classes on delete cascade,
  teacher_id uuid references profiles on delete cascade,
  primary key (class_id, teacher_id)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes on delete cascade,
  first_name text not null,
  last_name text not null
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes on delete cascade,
  name text not null,
  hidden_defaults text[] not null default '{}'
);

-- subject_id null = výchozí oblast pro všechny předměty (7 oblastí ze zadání)
create table criteria (
  id text primary key default gen_random_uuid()::text,
  subject_id uuid references subjects on delete cascade,
  name text not null,
  question text not null default ''
);

insert into criteria (id, subject_id, name, question) values
  ('k-znalosti', null, 'Znalosti', 'Rozumí žák učivu?'),
  ('k-dovednosti', null, 'Dovednosti', 'Dokáže učivo použít?'),
  ('k-samostatnost', null, 'Samostatnost', 'Zvládne pracovat bez pomoci?'),
  ('k-spoluprace', null, 'Spolupráce', 'Dokáže pracovat s ostatními?'),
  ('k-ukoly', null, 'Plnění úkolů', 'Dokončí zadanou práci?'),
  ('k-pokrok', null, 'Pokrok', 'Zlepšuje se?'),
  ('k-sebehodnoceni', null, 'Sebehodnocení', 'Ví, co umí a co potřebuje zlepšit?');

create table assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  teacher_id uuid not null references profiles default auth.uid(),
  date date not null default current_date,
  topic text not null default '',
  goal text not null default '',
  success_criterion text not null default '',
  fb_good text not null default '',
  fb_todo text not null default '',
  fb_next text not null default '',
  swot_s text not null default '',
  swot_w text not null default '',
  swot_o text not null default '',
  swot_t text not null default '',
  swot_proposed boolean not null default false,
  next_goal text not null default '',
  self_code text unique,           -- jednorázový kód pro sebehodnocení (QR)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assessment_scores (
  assessment_id uuid references assessments on delete cascade,
  criterion_id text references criteria on delete cascade,
  level smallint not null check (level between 1 and 5),  -- 1 = nejvyšší zvládnutí
  primary key (assessment_id, criterion_id)
);

create table self_assessments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references assessments on delete cascade,
  learned text not null default '',
  went_well text not null default '',
  struggle text not null default '',
  need_help text not null default '',
  next_want text not null default '',
  submitted_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  assessment_id uuid references assessments on delete set null,
  text text not null,
  set_on date not null,
  due date not null,
  status text not null default 'rozpracovany' check (status in ('rozpracovany', 'splneny', 'nesplneny'))
);

create table summaries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  kind text not null check (kind in ('tyden', 'mesic', 'pololeti')),
  period_from date not null,
  period_to date not null,
  sections jsonb not null,          -- [{key,title,sentences:[{id,text,sources[]}]}]
  teacher_note text not null default '',
  status text not null default 'navrh' check (status in ('navrh', 'schvaleno')),
  version int not null default 1,
  history jsonb not null default '[]',
  approved_by uuid references profiles,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table phrases (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references profiles on delete cascade default auth.uid(),
  kind text not null check (kind in ('good', 'todo', 'next')),
  text text not null
);

create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  entity text not null,
  entity_id text not null,
  action text not null,
  diff jsonb
);

-- ─── Audit: kdo co kdy změnil (záznamy jde opravovat) ───────────────────────
create or replace function log_change() returns trigger language plpgsql security definer as $$
begin
  insert into audit_log (entity, entity_id, action, diff)
  values (tg_table_name, coalesce(new.id, old.id)::text, lower(tg_op),
          case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) else null end);
  return coalesce(new, old);
end $$;

create trigger audit_assessments after insert or update or delete on assessments for each row execute function log_change();
create trigger audit_goals after insert or update or delete on goals for each row execute function log_change();
create trigger audit_summaries after insert or update or delete on summaries for each row execute function log_change();

-- ─── Row Level Security ─────────────────────────────────────────────────────
create or replace function teaches(c uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from class_teachers where class_id = c and teacher_id = auth.uid())
$$;

alter table schools enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table class_teachers enable row level security;
alter table students enable row level security;
alter table subjects enable row level security;
alter table criteria enable row level security;
alter table assessments enable row level security;
alter table assessment_scores enable row level security;
alter table self_assessments enable row level security;
alter table goals enable row level security;
alter table summaries enable row level security;
alter table phrases enable row level security;
alter table audit_log enable row level security;

create policy own_profile on profiles for select using (id = auth.uid());
create policy own_school on schools for select using (id = (select school_id from profiles where id = auth.uid()));
create policy my_classes on classes for all using (teaches(id));
create policy my_class_links on class_teachers for select using (teacher_id = auth.uid());
create policy my_students on students for all using (teaches(class_id));
create policy my_subjects on subjects for all using (teaches(class_id));
create policy criteria_read on criteria for select using (subject_id is null or teaches((select class_id from subjects s where s.id = subject_id)));
create policy criteria_write on criteria for all using (subject_id is not null and teaches((select class_id from subjects s where s.id = subject_id)));
create policy my_assessments on assessments for all using (teaches((select class_id from students s where s.id = student_id)));
create policy my_scores on assessment_scores for all using (exists (select 1 from assessments a where a.id = assessment_id));
create policy my_self on self_assessments for select using (exists (select 1 from assessments a where a.id = assessment_id));
create policy my_goals on goals for all using (teaches((select class_id from students s where s.id = student_id)));
create policy my_summaries on summaries for all using (teaches((select class_id from students s where s.id = student_id)));
create policy my_phrases on phrases for all using (teacher_id = auth.uid());
-- audit_log: čte jen služba / správce, ne klient.

-- ─── Sebehodnocení žáka bez účtu: jednorázový kód ───────────────────────────
-- Volá se anonymně (anon key). Kód po odevzdání zanikne.
create or replace function submit_self_assessment(
  p_code text, p_learned text, p_went_well text, p_struggle text, p_need_help text, p_next_want text
) returns boolean language plpgsql security definer as $$
declare a_id uuid;
begin
  update assessments set self_code = null where self_code = upper(p_code) returning id into a_id;
  if a_id is null then return false; end if;
  insert into self_assessments (assessment_id, learned, went_well, struggle, need_help, next_want)
  values (a_id, p_learned, p_went_well, p_struggle, p_need_help, p_next_want)
  on conflict (assessment_id) do update set learned = excluded.learned, went_well = excluded.went_well,
    struggle = excluded.struggle, need_help = excluded.need_help, next_want = excluded.next_want, submitted_at = now();
  return true;
end $$;
grant execute on function submit_self_assessment to anon;

-- ─── Vedení školy: jen agregace, žádná jména ani úrovně žáků ───────────────
create or replace function management_stats(p_from date, p_to date)
returns table (class_name text, subject_name text, records bigint, with_feedback bigint, goals bigint, goals_done bigint, self_assessed bigint, approved_summaries bigint)
language sql stable security definer as $$
  select c.name, sub.name,
    count(distinct a.id),
    count(distinct a.id) filter (where a.fb_good <> '' and a.fb_next <> ''),
    (select count(*) from goals g where g.subject_id = sub.id and g.set_on between p_from and p_to),
    (select count(*) from goals g where g.subject_id = sub.id and g.set_on between p_from and p_to and g.status = 'splneny'),
    count(distinct sa.id),
    (select count(*) from summaries s where s.subject_id = sub.id and s.status = 'schvaleno' and s.period_to between p_from and p_to)
  from subjects sub
  join classes c on c.id = sub.class_id
  left join assessments a on a.subject_id = sub.id and a.date between p_from and p_to
  left join self_assessments sa on sa.assessment_id = a.id
  where c.school_id = (select school_id from profiles where id = auth.uid() and role = 'vedeni')
  group by c.name, sub.name, sub.id
$$;
