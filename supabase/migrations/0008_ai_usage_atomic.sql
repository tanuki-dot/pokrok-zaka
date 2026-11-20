-- Atomický inkrement denního počtu AI požadavků.
-- Dřív to funkce ai-navrh dělala jako čti-pak-zapiš (select calls → upsert calls+1):
-- při dvou souběžných požadavcích oba přečetli stejné N a zapsali N+1, takže se
-- ztrácely zápisy a limit šlo přestřelit. Jeden příkaz to řeší atomicky.
-- Vrací nový počet za dnešek; volá jen serverová funkce (service role).

create or replace function ai_usage_bump(p_teacher uuid) returns integer
  language sql security definer set search_path = public as $$
  insert into ai_usage (teacher_id, day, calls) values (p_teacher, current_date, 1)
  on conflict (teacher_id, day) do update set calls = ai_usage.calls + 1
  returning calls
$$;

revoke all on function ai_usage_bump(uuid) from public;
grant execute on function ai_usage_bump(uuid) to service_role;
