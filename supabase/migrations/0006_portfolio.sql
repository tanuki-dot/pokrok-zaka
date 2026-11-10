-- Portfolio žáka (zadání bod 8): komentář učitele k práci a propojení práce
-- s konkrétními vzdělávacími cíli hodnocení. Rozšíření tabulky attachments.
-- RLS zůstává (owns_assessment), náhledy řeší klient z úložiště.

alter table attachments add column if not exists note text not null default '';
alter table attachments add column if not exists goal_ids text[] not null default '{}';
