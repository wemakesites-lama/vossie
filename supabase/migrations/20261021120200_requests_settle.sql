-- Looking For requests close themselves (stage L) and remind once (stage M): the settle and the nightly job (supabase
-- step 2b plan, Task 3; decision 2; amendments 6 and 8).
--
-- public.settle_requests(p_now) is settleRequests (lib/data/requests.ts:115): it stores every due close (closed_by
-- 'auto', closed_at at the start of the closing day in SAST, closedAtFor in lib/looking-for/rules.ts) and tells the
-- asker once, then reminds each asker once from REMINDER_DAYS_BEFORE (2) days before the closing day (reminderDue;
-- reminded_for marks the closing day reminded of, so a moved day allows a new reminder). It closes first, then reminds
-- only rows still open, so a request that closes on this pass gets no reminder (stage M). It returns how many it closed.
--
-- - Server only: the app calls it with the admin client from request-time code, where settleRequests(now) runs today,
--   and pg_cron calls it nightly at 00:05 SAST (22:05 UTC) as a backstop.
-- - p_now is capped at now(), so no caller can close requests early.
-- - A transaction-level advisory lock serialises settles, and each UPDATE ... RETURNING re-checks its rows, so two
--   looks close, remind and tell once.
-- - Neither UPDATE sets updated_at, so closes_on doesn't move. There's no trigger on requests (checked 2026-10-21).
-- - Lock order: the settle takes its own lock, then row locks. save_request and set_request_open take the asker's lock
--   and then one row, and never the settle's lock, so there's no cycle.

-- requestAutoClosedText and requestCloseReminderText (lib/looking-for/words.ts), word for word; dates as dayMonth.
-- Stable, not immutable: to_char is stable (amendment 8). 'FMDD Mon' is English without the TM prefix: "5 Nov".
create function private.request_close_why(needed date)
returns text language sql stable set search_path = '' as $$
  select case when needed is not null then '3 days after the date you needed it by' else 'after 30 days with no changes' end;
$$;

create function private.request_auto_closed_note_text(title text, needed date)
returns text language sql stable set search_path = '' as $$
  select 'Your request ' || title || ' closed automatically ' || private.request_close_why(needed)
    || '. Reopen it in Your requests if you still need it.';
$$;

create function private.request_close_reminder_note_text(title text, closes date, needed date)
returns text language sql stable set search_path = '' as $$
  select 'Your request ' || title || ' closes automatically on ' || pg_catalog.to_char(closes, 'FMDD Mon') || ', '
    || private.request_close_why(needed) || '. Still need it? '
    || case when needed is not null then 'Give it a new date in Your requests.'
            else 'Edit it in Your requests and it stays up for 30 days more.' end;
$$;

-- The words run only inside the settle (as its owner).
revoke all on function private.request_close_why(date), private.request_auto_closed_note_text(text, date),
  private.request_close_reminder_note_text(text, date, date)
from public, anon, authenticated, service_role;

-- settleRequests (lib/data/requests.ts): stores every due close and the one reminder, telling the asker in the app.
create function public.settle_requests(p_now timestamptz default now())
returns int language plpgsql volatile security definer set search_path = '' as $$
declare
  today date := private.sast_day(least(coalesce(p_now, now()), now()));
  closed int;
begin
  perform pg_advisory_xact_lock(hashtext('vossie:settle-requests'), 0);
  with done as (
    update public.requests r
    set status = 'closed', closed_by = 'auto',
        closed_at = (r.closes_on::timestamp at time zone 'Africa/Johannesburg')   -- closedAtFor(day)
    where r.status = 'open' and r.hidden_at is null and r.asker_id is not null and r.closes_on <= today
    returning r.id, r.asker_id, r.title, r.needed_by
  )
  insert into public.notifications (account_id, kind, subject_id, text, href)
  select d.asker_id, 'request-update', d.id, private.request_auto_closed_note_text(d.title, d.needed_by), '/account/requests'
  from done d;
  get diagnostics closed = row_count;
  with due as (
    update public.requests r set reminded_for = r.closes_on
    where r.status = 'open' and r.hidden_at is null and r.asker_id is not null
      and r.closes_on - 2 <= today and today < r.closes_on            -- REMINDER_DAYS_BEFORE
      and r.reminded_for is distinct from r.closes_on
    returning r.id, r.asker_id, r.title, r.closes_on, r.needed_by
  )
  insert into public.notifications (account_id, kind, subject_id, text, href)
  select d.asker_id, 'request-update', d.id,
    private.request_close_reminder_note_text(d.title, d.closes_on, d.needed_by), '/account/requests'
  from due d;
  return closed;
end;
$$;
revoke all on function public.settle_requests(timestamptz) from public, anon, authenticated;
grant execute on function public.settle_requests(timestamptz) to service_role;

-- Nightly at 00:05 SAST (22:05 UTC): the backstop for requests nobody looks at. Pages still settle first.
select cron.schedule('settle-requests', '5 22 * * *', 'select public.settle_requests()');
