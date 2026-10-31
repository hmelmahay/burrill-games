begin;
-- One durable reporting baseline. Reapplying this migration never resets it again.
-- Saved games remain intact. Only the owner's reporting window changes.
create table if not exists arcade_private.usage_settings (
 singleton boolean primary key default true check (singleton),
 reporting_since timestamptz not null
);
alter table arcade_private.usage_settings enable row level security;
revoke all on arcade_private.usage_settings from public, anon, authenticated;
insert into arcade_private.usage_settings(singleton,reporting_since)
values(true,now()) on conflict(singleton) do nothing;

create or replace function arcade_private.usage_report(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; since_at timestamptz; tracking_at timestamptz;
begin
 if not exists(select 1 from auth.users u where u.id=auth.uid()
   and u.email_confirmed_at is not null
   and lower(u.email) in ('pokerdad123@gmail.com','mike@spille.co')) then
   raise exception 'Dashboard access is limited to Steve and Mike.' using errcode='42501';
 end if;
 if p_days not in (7,30,90) then raise exception 'Choose 7, 30, or 90 days.'; end if;
 select reporting_since into strict tracking_at from arcade_private.usage_settings where singleton;
 since_at := greatest(now() - make_interval(days => p_days), tracking_at);
 with rooms_all as (
   select id,game,status,created_at,(status in ('playing','ended')) as started from public.arcade_rooms where created_at >= tracking_at
   union all select id,'needle',status,created_at,(jsonb_array_length(called)>0 or status='ended') from public.games where created_at >= tracking_at
 ), rooms as (select * from rooms_all where created_at >= since_at),
 people_all as (
   select p.id,p.room_id,trim(p.name) as name,p.created_at,
     p.name in ('Ada 🤖','Brick 🤖','Cleo 🤖','Dot 🤖','Ember 🤖','Fig 🤖','Gus 🤖') as bot
   from public.arcade_players p where p.created_at >= tracking_at
   union all
   select id,game_id,trim(player_name),created_at,false from public.cards where created_at >= tracking_at and nullif(trim(player_name),'') is not null
 ), people as (
   select p.*,r.game from people_all p join rooms_all r on r.id=p.room_id
   where p.created_at >= since_at and not p.bot and nullif(p.name,'') is not null
 ), events as (select * from public.arcade_usage_events where created_at>=since_at),
 visits as (select * from events where kind='page_view'),
 per_player as (
   select lower(name) as identity,max(name) as name,count(distinct room_id) as sessions,
   max(created_at) as last_joined,jsonb_agg(distinct game) as games
   from people group by lower(name)
 ), known_players as (
   select lower(p.name) as identity,max(p.name) as name,count(distinct p.room_id) as sessions,
     max(p.created_at) as last_joined,jsonb_agg(distinct r.game) as games
   from people_all p join rooms_all r on r.id=p.room_id
   where not p.bot and nullif(p.name,'') is not null group by lower(p.name)
 ), group_sizes as (
   select r.id,count(p.id) filter(where not p.bot) as humans,count(p.id) filter(where p.bot) as bots
   from rooms r left join people_all p on p.room_id=r.id group by r.id
 ), per_game as (
   select r.game,count(*) as rooms,count(*) filter(where r.started) as started,
   count(*) filter(where r.status='ended') as finished,
   count(*) filter(where r.status<>'ended' and r.created_at<now()-interval '24 hours') as unfinished,
   coalesce(sum(g.humans),0) as player_seats,round(avg(g.humans),1) as avg_group
   from rooms r join group_sizes g on g.id=r.id group by r.game
 ), session_spans as (
   select session_id,extract(epoch from (max(created_at)-min(created_at)))/60 as minutes
   from events where kind in ('page_view','heartbeat') group by session_id
 )
 select jsonb_build_object(
   'days',p_days,'generated_at',now(),'tracking_since',tracking_at,
   'overview',jsonb_build_object(
     'visitors',(select count(distinct visitor_id) from visits),
     'visits',(select count(distinct session_id) from visits),
     'page_views',(select count(*) from visits),
     'returning_browsers',(select count(*) from (select visitor_id from visits group by visitor_id having count(distinct session_id)>1) v),
     'active_browsers',(select count(distinct visitor_id) from events where kind in ('page_view','heartbeat') and created_at>now()-interval '5 minutes'),
     'rooms',(select count(*) from rooms),'started',(select count(*) from rooms where started),
     'finished',(select count(*) from rooms where status='ended'),
     'unfinished',(select count(*) from rooms where status<>'ended' and created_at<now()-interval '24 hours'),
     'player_names',(select count(*) from per_player),
     'player_seats',(select count(distinct id) from people),
     'repeat_names',(select count(*) from per_player where sessions>1),
     'inactive_names',(select count(*) from known_players where last_joined<since_at),
     'bot_seats',(select coalesce(sum(bots),0) from group_sizes),
     'avg_group',(select round(avg(humans),1) from group_sizes),
     'avg_visit_minutes',(select round(avg(minutes)::numeric,1) from session_spans where minutes>0 and minutes<720),
     'avg_game_minutes',(select round(avg(extract(epoch from(t.ended_at-t.started_at))/60)::numeric,1)
       from arcade_private.game_times t join rooms r on r.id=t.room_id where t.ended_at>t.started_at),
     'timed_games',(select count(*) from arcade_private.game_times t join rooms r on r.id=t.room_id where t.ended_at>t.started_at),
     'errors',(select count(*) from events where kind='client_error')
   ),
   'games',coalesce((select jsonb_agg(to_jsonb(g) order by g.rooms desc) from per_game g),'[]'::jsonb),
   'players',coalesce((select jsonb_agg(to_jsonb(p) order by p.last_joined desc) from per_player p),'[]'::jsonb),
   'inactive_players',coalesce((select jsonb_agg(to_jsonb(p) order by p.last_joined desc) from known_players p where last_joined<since_at),'[]'::jsonb),
   'daily',coalesce((select jsonb_agg(jsonb_build_object('date',d::date,'rooms',
      (select count(*) from rooms r where (r.created_at at time zone 'America/Denver')::date=d::date),
      'visits',(select count(distinct session_id) from visits v where (v.created_at at time zone 'America/Denver')::date=d::date)) order by d)
      from generate_series((since_at at time zone 'America/Denver')::date,(now() at time zone 'America/Denver')::date,interval '1 day') d),'[]'::jsonb),
   'devices',coalesce((select jsonb_agg(to_jsonb(d)) from (select device,count(distinct visitor_id) as visitors from visits group by device) d),'[]'::jsonb),
   'sources',coalesce((select jsonb_agg(to_jsonb(d)) from (select coalesce(nullif(referrer,''),'Direct / unknown') as source,count(distinct session_id) as visits from visits group by referrer order by count(distinct session_id) desc limit 10) d),'[]'::jsonb),
   'clicks',coalesce((select jsonb_agg(to_jsonb(c)) from (select game,count(*) as clicks from events where kind='game_click' group by game order by count(*) desc) c),'[]'::jsonb),
   'recent',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from
      (select r.id,r.game,r.status,r.created_at,g.humans as players from rooms r join group_sizes g on g.id=r.id order by r.created_at desc limit 30) r),'[]'::jsonb)
 ) into result;
 return result;
end $$;
commit;
