begin;
-- All fixtures, including owner identities, are rolled back at the end.
insert into auth.users(id,email,email_confirmed_at)
select 'afdf549f-4278-40a3-8e0a-141fed87e0c4','usage-qa@example.invalid',now();
insert into public.arcade_rooms(id,game,code,created_at) values('a6cb8611-3cbd-40b4-8740-cd5a3c7fcf52','quiz','Z9Q7',now()-interval '40 days');
insert into public.arcade_players(room_id,name,created_at) values('a6cb8611-3cbd-40b4-8740-cd5a3c7fcf52','Usage QA Inactive',now()-interval '40 days');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"afdf549f-4278-40a3-8e0a-141fed87e0c4","role":"authenticated"}',true);
do $$ begin
 begin perform public.arcade_usage_report(30); raise exception 'Unauthorized user was allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update auth.users set email_confirmed_at=now() where lower(email)='pokerdad123@gmail.com';
select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true) from auth.users where lower(email)='pokerdad123@gmail.com';
set local role authenticated;
do $$ declare report jsonb; begin
 report:=public.arcade_usage_report(30);
 if not report ?& array['overview','games','players','daily'] then raise exception 'Missing dashboard fields'; end if;
 if not (report->'inactive_players' @> '[{"name":"Usage QA Inactive"}]'::jsonb) then raise exception 'Inactive player missing'; end if;
 if not (public.arcade_usage_report(90)->'players' @> '[{"name":"Usage QA Inactive"}]'::jsonb) then raise exception 'Date range did not restore active player'; end if;
 if jsonb_typeof(report->'games')<>'array' then raise exception 'Games not array'; end if;
 begin perform public.arcade_usage_report(1000); raise exception 'Invalid range accepted';
 exception when others then if sqlerrm='Invalid range accepted' then raise; end if; end;
end $$;
reset role;
insert into auth.users(id,email,email_confirmed_at) select 'b7a9f989-dc5a-4ffb-8e6e-6d9238868b03','mike@spille.co',now() where not exists(select 1 from auth.users where lower(email)='mike@spille.co');
update auth.users set email_confirmed_at=now() where lower(email)='mike@spille.co';
select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true) from auth.users where lower(email)='mike@spille.co';
set local role authenticated;
select jsonb_build_object('owner_access','Mike confirmed','overview',public.arcade_usage_report(7)->'overview') as result;
reset role;
update auth.users set email_confirmed_at=null where lower(email)='mike@spille.co';
set local role authenticated;
do $$ begin
 begin perform public.arcade_usage_report(30); raise exception 'Unconfirmed user was allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
insert into public.arcade_usage_events(visitor_id,session_id,kind,route,device)
values('afdf549f-4278-40a3-8e0a-141fed87e0c4','afdf549f-4278-40a3-8e0a-141fed87e0c4','page_view','/home','phone');
do $$ begin
 begin perform * from public.arcade_usage_events; raise exception 'Anonymous read allowed';
 exception when insufficient_privilege then null; end;
 begin perform public.arcade_usage_report(30); raise exception 'Anonymous reporting allowed';
 exception when insufficient_privilege then null; end;
 begin insert into public.arcade_usage_events(visitor_id,session_id,kind,route,device) values(gen_random_uuid(),gen_random_uuid(),'page_view','/quiz/play/SECRET','phone');raise exception 'Room-code route accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
