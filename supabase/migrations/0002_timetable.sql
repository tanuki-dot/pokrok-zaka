-- Rozvrh hodin a zvonění (od verze 0.0.3).
-- Zvonění je společné pro školu, rozvrh má každý učitel svůj.

create table bells (
  school_id uuid not null references schools on delete cascade,
  period smallint not null check (period between 0 and 15),
  starts_at time not null,
  ends_at time not null check (ends_at > starts_at),
  primary key (school_id, period)
);

create table timetable_entries (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles on delete cascade default auth.uid(),
  day smallint not null check (day between 0 and 4),       -- 0 = pondělí … 4 = pátek
  period smallint not null,
  class_id uuid not null references classes on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  room text check (char_length(room) <= 12),                 -- číslo učebny (nepovinné)
  unique (teacher_id, day, period)
);

alter table assessments add column lesson smallint;          -- číslo vyučovací hodiny

alter table bells enable row level security;
alter table timetable_entries enable row level security;

create policy bells_read on bells for select
  using (school_id = (select school_id from profiles where id = auth.uid()));
create policy my_timetable on timetable_entries for all
  using (teacher_id = auth.uid() and teaches(class_id))
  with check (teacher_id = auth.uid() and teaches(class_id));
