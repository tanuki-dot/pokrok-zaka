-- Podpůrné dokumenty žáka (zadání bod 1): PLPP, IVP, doporučení PPP/SPC a další.
-- Vázané na žáka (ne na hodnocení). Popis v tabulce, obsah v úložišti (bucket „dokumenty“).

create table documents (
  id text primary key,
  student_id text not null references students on delete cascade,
  kind text not null default 'jine',
  name text not null,
  mime text not null default '',
  size integer not null default 0,
  added_at timestamptz not null default now()
);

alter table documents enable row level security;
-- Učitel vidí a spravuje jen dokumenty svých žáků (stejná logika jako u cílů/souhrnů).
create policy documents_all on documents for all using (teaches_student(student_id)) with check (teaches_student(student_id));

-- Úložiště obsahu dokumentů: privátní bucket, cesta <student_id>/<document_id>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('dokumenty', 'dokumenty', false, 10485760)
on conflict (id) do nothing;

create policy dokumenty_read on storage.objects for select to authenticated
  using (bucket_id = 'dokumenty' and teaches_student(split_part(name, '/', 1)));
create policy dokumenty_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumenty' and teaches_student(split_part(name, '/', 1)));
create policy dokumenty_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dokumenty' and teaches_student(split_part(name, '/', 1)));
