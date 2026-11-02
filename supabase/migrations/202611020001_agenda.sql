begin;
create table public.appointments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 160),
 category text not null check (category in ('Atendimento','Pessoal')),
 date date not null check (date between '1900-01-01' and '2100-12-31'),
 time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 duration integer not null check (duration between 5 and 1440),
 recurrence text not null default 'none' check (recurrence in ('none','weekly','biweekly','monthly')),
 location text not null default '' check (length(location)<=500),
 notes text not null default '' check (length(notes)<=2000),
 status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
 created_at timestamptz not null default now(),
 check (split_part(time,':',1)::int*60+split_part(time,':',2)::int+duration<=1440)
);
alter table public.appointments enable row level security;
alter table public.appointments force row level security;
revoke all on public.appointments from anon;
grant select,insert,update,delete on public.appointments to authenticated;
create policy "Read own appointments" on public.appointments for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own appointments" on public.appointments for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own appointments" on public.appointments for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Delete own appointments" on public.appointments for delete to authenticated using ((select auth.uid())=user_id);
create index appointments_user_date on public.appointments(user_id,date);

create function public.occurs_on(p_start date,p_recurrence text,p_day date) returns boolean
language sql immutable set search_path='' as $$
 select p_day>=p_start and case p_recurrence
 when 'none' then p_day=p_start
 when 'weekly' then (p_day-p_start)%7=0
 when 'biweekly' then (p_day-p_start)%14=0
 when 'monthly' then extract(day from p_day)=least(extract(day from p_start),extract(day from (date_trunc('month',p_day)+interval '1 month - 1 day')))
 else false end;
$$;

create function public.recurrences_overlap(a_start date,a_repeat text,b_start date,b_repeat text) returns boolean
language plpgsql immutable set search_path='' as $$
declare anchor date; first_month date; n integer; candidate date; month_start date; original_day integer;
begin
 if a_repeat='none' then return public.occurs_on(b_start,b_repeat,a_start); end if;
 if b_repeat='none' then return public.occurs_on(a_start,a_repeat,b_start); end if;
 if a_repeat<>'monthly' and b_repeat<>'monthly' then
  return (a_start-b_start) % (case when a_repeat='biweekly' and b_repeat='biweekly' then 14 else 7 end)=0;
 end if;
 anchor:=greatest(a_start,b_start);
 first_month:=date_trunc('month',anchor)::date;
 original_day:=extract(day from case when a_repeat='monthly' then a_start else b_start end)::int;
 -- 800 anos cobrem o ciclo gregoriano combinado com repetições quinzenais.
 for n in 0..9600 loop
  month_start:=(first_month+make_interval(months=>n))::date;
  candidate:=month_start+least(original_day,extract(day from (month_start+interval '1 month - 1 day'))::int)-1;
  if public.occurs_on(a_start,a_repeat,candidate) and public.occurs_on(b_start,b_repeat,candidate) then return true; end if;
 end loop;
 return false;
end;
$$;

create function public.guard_appointment() returns trigger
language plpgsql set search_path='' as $$
declare other public.appointments; start_min integer; other_min integer;
begin
 if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'unauthorized'; end if;
 if tg_op='UPDATE' and (new.user_id<>old.user_id or new.id<>old.id) then raise exception 'immutable_owner'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if new.status='cancelled' then return new; end if;
 start_min:=split_part(new.time,':',1)::int*60+split_part(new.time,':',2)::int;
 for other in select * from public.appointments where user_id=new.user_id and id<>new.id and status='scheduled' loop
  other_min:=split_part(other.time,':',1)::int*60+split_part(other.time,':',2)::int;
  if start_min<other_min+other.duration and other_min<start_min+new.duration
   and public.recurrences_overlap(new.date,new.recurrence,other.date,other.recurrence) then raise exception 'schedule_conflict'; end if;
 end loop;
 return new;
end;
$$;
create trigger appointments_guard before insert or update on public.appointments for each row execute function public.guard_appointment();

create function public.save_appointment(p_id uuid,p_event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved public.appointments;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 -- Lock antes do comando: a nova consulta vê alterações confirmadas concorrentes.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if p_id is null then
  insert into public.appointments(title,category,date,time,duration,recurrence,location,notes,status)
   values(p_event->>'title',p_event->>'category',(p_event->>'date')::date,p_event->>'time',(p_event->>'duration')::int,p_event->>'recurrence',p_event->>'location',p_event->>'notes',p_event->>'status') returning * into saved;
 else
  update public.appointments set title=p_event->>'title',category=p_event->>'category',date=(p_event->>'date')::date,time=p_event->>'time',duration=(p_event->>'duration')::int,recurrence=p_event->>'recurrence',location=p_event->>'location',notes=p_event->>'notes',status=p_event->>'status'
   where id=p_id and user_id=auth.uid() returning * into saved;
  if not found then raise exception 'not_found'; end if;
 end if;
 return to_jsonb(saved)-'user_id'-'created_at';
end;
$$;
revoke all on function public.save_appointment(uuid,jsonb) from public,anon;
grant execute on function public.save_appointment(uuid,jsonb) to authenticated;
revoke all on function public.guard_appointment() from public,anon;
commit;
