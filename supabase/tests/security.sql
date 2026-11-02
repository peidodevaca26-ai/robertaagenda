-- Execute em banco Supabase de TESTE após aplicar a migração. Tudo é revertido.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','agenda-test-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','agenda-test-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
insert into public.appointments(id,title,category,date,time,duration,recurrence)
 values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Teste privado','Pessoal','2026-01-31','09:00',60,'monthly');
do $$ begin
 if not public.occurs_on('2026-01-31','monthly','2026-02-28') then raise exception 'monthly failed'; end if;
 begin
  insert into public.appointments(title,category,date,time,duration,recurrence) values ('Conflito','Pessoal','2026-02-28','09:30',30,'none');
  raise exception 'conflict should fail';
 exception when others then
  if sqlerrm not like '%schedule_conflict%' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ declare n integer; begin
 select count(*) into n from public.appointments;
 if n<>0 then raise exception 'RLS read isolation failed'; end if;
 update public.appointments set title='Invasão' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'RLS update isolation failed'; end if;
 delete from public.appointments where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'RLS delete isolation failed'; end if;
 begin
  insert into public.appointments(user_id,title,category,date,time,duration) values ('11111111-1111-4111-8111-111111111111','Invasão','Pessoal','2026-01-01','10:00',30);
  raise exception 'RLS insert should fail';
 exception when others then
  if sqlerrm not like '%unauthorized%' and sqlstate<>'42501' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ declare saved jsonb; n integer; begin
 saved:=public.save_appointment(null,'{"title":"RPC teste","category":"Atendimento","date":"2026-06-02","time":"16:00","duration":30,"recurrence":"weekly","location":"Sala","notes":"teste","status":"scheduled"}'::jsonb);
 if saved->>'title'<>'RPC teste' then raise exception 'RPC create failed'; end if;
 saved:=public.save_appointment((saved->>'id')::uuid,saved||'{"title":"Editado","status":"cancelled"}'::jsonb);
 if saved->>'status'<>'cancelled' or saved->>'title'<>'Editado' then raise exception 'RPC update failed'; end if;
 delete from public.appointments where id=(saved->>'id')::uuid;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'delete own failed'; end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform * from public.appointments;
  raise exception 'anon read should fail';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
