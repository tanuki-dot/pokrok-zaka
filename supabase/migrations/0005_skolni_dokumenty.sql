-- Školní dokumenty (zadání bod 1): ŠVP a tematické plány. Rozšíření tabulky documents
-- o školní rozsah (vázaný na školu, volitelně na předmět). Žákovské dokumenty (0004)
-- zůstávají beze změny (scope 'zak').

alter table documents alter column student_id drop not null;
alter table documents add column scope text not null default 'zak';
alter table documents add column school_id text references schools on delete cascade;
alter table documents add column subject_id text references subjects on delete set null;

-- Učitel spravuje školu, kterou založil nebo v níž učí aspoň jednu třídu.
create or replace function manages_school(s text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from schools x where x.id = s and x.created_by = auth.uid())
      or exists (select 1 from classes c where c.school_id = s and teaches(c.id))
$$;

drop policy documents_all on documents;
create policy documents_all on documents for all
  using ((student_id is not null and teaches_student(student_id)) or (school_id is not null and manages_school(school_id)))
  with check ((student_id is not null and teaches_student(student_id)) or (school_id is not null and manages_school(school_id)));

-- Úložiště: školní dokumenty mají cestu skola/<school_id>/<document_id>
-- (žákovské zůstávají <student_id>/<document_id>). Politiky se sčítají (OR).
create policy dokumenty_read_skola on storage.objects for select to authenticated
  using (bucket_id = 'dokumenty' and split_part(name, '/', 1) = 'skola' and manages_school(split_part(name, '/', 2)));
create policy dokumenty_insert_skola on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumenty' and split_part(name, '/', 1) = 'skola' and manages_school(split_part(name, '/', 2)));
create policy dokumenty_delete_skola on storage.objects for delete to authenticated
  using (bucket_id = 'dokumenty' and split_part(name, '/', 1) = 'skola' and manages_school(split_part(name, '/', 2)));
