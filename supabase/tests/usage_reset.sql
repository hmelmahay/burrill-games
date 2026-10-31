begin;
-- No persistent test data or baseline changes.
update arcade_private.usage_settings set reporting_since=now();
insert into public.arcade_rooms(id,game,code,created_at,status) values
 ('b09ed819-0d08-4b68-a966-ac782b277ea5','quiz','Q7R8',now()-interval '1 minute','ended'),
 ('b09ed819-0d08-4b68-a966-ac782b277ea6','quiz','Q7R9',now(),'playing');
insert into public.arcade_players(room_id,name,created_at) values
 ('b09ed819-0d08-4b68-a966-ac782b277ea5','Reset Old',now()-interval '1 minute'),
 ('b09ed819-0d08-4b68-a966-ac782b277ea5','New Join Old Room',now()),
 ('b09ed819-0d08-4b68-a966-ac782b277ea6','Reset New',now());
insert into public.arcade_usage_events(visitor_id,session_id,kind,route,device,created_at) values
 (gen_random_uuid(),gen_random_uuid(),'page_view','/home','phone',now()-interval '1 minute'),
 (gen_random_uuid(),gen_random_uuid(),'page_view','/home','phone',now());
select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true) from auth.users where lower(email)='pokerdad123@gmail.com';
set local role authenticated;
do $$ declare report jsonb; days integer; begin
 foreach days in array array[7,30,90] loop
  report:=public.arcade_usage_report(days);
  if (report->'overview'->>'player_names')::int<>1
    or (report->'overview'->>'player_seats')::int<>1
    or (report->'overview'->>'rooms')::int<>1
    or (report->'overview'->>'visitors')::int<>1
    or (report->'overview'->>'visits')::int<>1
    or (report->'overview'->>'inactive_names')::int<>0
    or (report->'overview'->>'finished')::int<>0 then
    raise exception 'Fresh-start counts incorrect for % days: %',days,report->'overview';
  end if;
  if not (report->'players' @> '[{"name":"Reset New"}]'::jsonb)
    or jsonb_array_length(report->'recent')<>1
    or jsonb_array_length(report->'daily')<>1 then
    raise exception 'Fresh-start lists incorrect';
  end if;
 end loop;
 begin update arcade_private.usage_settings set reporting_since=now()-interval '1 year';
 raise exception 'Browser role changed baseline'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
