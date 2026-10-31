"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isDashboardEmail } from "@/lib/usage";
import { percentage, playersCsv, type UsageReport } from "@/lib/usage-report";
import styles from "./styles";
const TITLES:Record<string,string>={needle:"Needle Drop",quiz:"Quiz Rush",majority:"Majority Rules",scatter:"Scatter Sprint",emoji:"Emoji Cinema",ballpark:"Ballpark",twotruths:"Two Truths & a Lie",hottake:"Hot Take",doodle:"Doodle Dash",vibe:"Vibe Check",chain:"Chain Gang",chameleon:"Chameleon",partybluff:"Party Bluff ↗",spillway:"The Spillway ↗",blitzkrieg:"Blitzkrieg Chess ↗"};
const title=(s:string)=>TITLES[s]||s;
const num=(n:number|null)=>n===null?"—":n.toLocaleString();
const date=(s:string)=>new Date(s).toLocaleString("en-US",{timeZone:"America/Denver",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});

export default function Dashboard() {
 const [user,setUser]=useState<string|null>(null),[checking,setChecking]=useState(true);
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [days,setDays]=useState(30),[report,setReport]=useState<UsageReport|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const requestId=useRef(0);
 useEffect(()=>{
   let mounted=true;
   const update=async()=>{
     const {data:{user:verified}}=await supabase.auth.getUser();
     if (!mounted) return;
     setUser(verified?.email&&isDashboardEmail(verified.email)&&verified.email_confirmed_at?verified.email:null);
     setChecking(false);
   };
   void update();
   const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{ window.setTimeout(()=>{if(mounted) void update();},0); });
   return ()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 const load=useCallback(async()=>{
   if(!user) return;
   const request=++requestId.current;
   const {data,error:err}=await supabase.rpc("arcade_usage_report",{p_days:days});
   if(request!==requestId.current)return;
   if(err) {setError(err.code==="42501"?"Access is limited to Steve and Mike with confirmed email addresses.":"We couldn’t load usage data. Try refreshing in a moment.");setReport(null);}
   else {setError("");setReport(data as UsageReport);}
   setLoading(false);
 },[user,days]);
 useEffect(()=>{ if(!user)return; const first=setTimeout(()=>void load(),0); const timer=setInterval(()=>void load(),60_000);return ()=>{clearTimeout(first);clearInterval(timer);}; },[load,user]);
 async function login(create:boolean) {
   setMessage("");
   if(!isDashboardEmail(email)){setMessage("This dashboard is for Steve and Mike. Use your approved email address.");return;}
   if((create&&password.length<8)||!password){setMessage("Use a password with at least 8 characters.");return;}
   setBusy(true);
   try {
     if(create) {
       const {error}=await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{emailRedirectTo:location.origin+"/admin"}});
       setMessage(error?error.message:"Check your email to confirm your account, then return here and sign in. If you already have an account, use Sign in instead.");
     } else {
       const {error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
       if(error)setMessage("Sign-in failed. Check your password and make sure you confirmed your email.");
     }
   } finally {setBusy(false);}
 }
 async function signOut(){requestId.current++;setReport(null);setUser(null);await supabase.auth.signOut();}
 return <main className={styles.dashboard}>
   <header className={styles.header}><div><Link href="/" className={styles.back}>← Back to the arcade</Link><p className={styles.eyebrow}>THE BURR &amp; SPILL · OWNERS ONLY</p><h1>Behind the games<span>Usage dashboard</span></h1></div><span className={styles.badge}>PRIVATE</span></header>
   {checking?<p role="status">Checking your access…</p>:!user?<section className={styles.login}>
     <p className={styles.eyebrow}>STEVE &amp; MIKE</p><h2>See what’s getting played.</h2><p>Sign in with your approved email. Players don’t need accounts.</p>
     <form onSubmit={e=>{e.preventDefault();void login(false);}}><label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className={styles.primary} disabled={busy}>{busy?"Please wait…":"Sign in"}</button><button type="button" disabled={busy} onClick={()=>void login(true)}>First visit? Create your owner account</button></form><p role="status">{message}</p><p className={styles.note}>New accounts need email confirmation. Only the two approved, confirmed emails can read reporting data.</p>
   </section>:<>
   <div className={styles.toolbar}><div><label htmlFor="range">Show activity from</label><select id="range" value={days} onChange={e=>{requestId.current++;setReport(null);setDays(Number(e.target.value));}}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div><div className={styles.actions}><span className={styles.note}>{user}</span><button onClick={()=>{setLoading(true);void load();}} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button><button onClick={()=>void signOut()}>Sign out</button></div></div>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
   {!report&&!error&&<p role="status">Loading your arcade activity…</p>}
   {report&&<ReportView report={report}/>}
   </>}
 </main>;
}
export function ReportView({report}:{report:UsageReport}) {
 const [search,setSearch]=useState("");
 const [showInactive,setShowInactive]=useState(false);
 const source=showInactive?report.inactive_players:report.players;
 function exportPlayers(){if(!report)return;const blob=new Blob([playersCsv(source)],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`burr-spill-players-${report.days}days.csv`;a.click();URL.revokeObjectURL(url);}
 const people=source.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()))??[];
 const o=report.overview;
 const completion=percentage(o.finished,o.started);
 return <>
   {report.tracking_since&&<p className={styles.note}>Fresh start: counting activity from {date(report.tracking_since)} (Mountain time). Earlier activity is excluded from every date range.</p>}
   <div className={styles.statusline}><span className={styles.liveDot}/>{o.active_browsers} browser{o.active_browsers===1?"":"s"} active in the last 5 minutes<span>Updated {date(report.generated_at)} · Mountain time</span></div>
   <section className={styles.metrics} aria-label="Key usage metrics">
     <Metric label="Browser visitors" value={num(o.visitors)} detail={`${num(o.visits)} visits · ${num(o.page_views)} page views`} accent="cyan"/>
     <Metric label="Player names" value={num(o.player_names)} detail={`${num(o.player_seats)} human game joins · bots excluded`} accent="violet"/>
     <Metric label="Games created" value={num(o.rooms)} detail={`${num(o.started)} started · ${num(o.finished)} finished`} accent="orange"/>
     <Metric label="Finished / started" value={completion===null?"—":`${completion}%`} detail="Games created in this date range" accent="green"/>
   </section>
   <div className={styles.twoCols}>
   <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>THE BIG PICTURE</p><h2>Activity over time</h2></div><span className={styles.note}>Daily · Mountain time</span></div><div className={styles.legend}><span>🟠 Games created</span><span>🟣 Visits</span></div><ActivityChart data={report.daily}/>{!o.rooms&&!o.visits&&<p className={styles.empty}>No activity in this period yet. Share the arcade link to get started.</p>}</section>
   <section className={styles.panel}><p className={styles.eyebrow}>ARE THEY COMING BACK?</p><h2>Engagement</h2><dl className={styles.facts}><Fact label="Returning browsers" value={num(o.returning_browsers)}/><Fact label="Names in 2+ games" value={num(o.repeat_names)}/><Fact label="Previously seen, now inactive" value={num(o.inactive_names)}/><Fact label="Average group size" value={o.avg_group===null?"—":`${o.avg_group} humans`}/><Fact label="Average game duration" value={o.avg_game_minutes===null?"Collecting data":`${o.avg_game_minutes} min`}/><Fact label="Estimated visit duration" value={o.avg_visit_minutes===null?"Collecting data":`${o.avg_visit_minutes} min`}/><Fact label="Unfinished after 24 hours" value={num(o.unfinished)}/></dl><p className={styles.note}>Returning browsers have 2+ visits in this period. Duration uses new tracking only ({o.timed_games} timed games). Visit duration is approximate and needs multiple activity signals.</p></section>
   </div>
   <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>WHAT’S GETTING PLAYED</p><h2>Game popularity</h2></div><span className={styles.note}>In-app games · human joins</span></div><div className={styles.tableWrap}><table><thead><tr><th>Game</th><th>Created</th><th>Started</th><th>Finished</th><th>Human seats</th><th>Avg. group</th></tr></thead><tbody>{report.games.map(g=><tr key={g.game}><td><strong>{title(g.game)}</strong><div className={styles.bar}><span style={{width:`${g.rooms/Math.max(1,...report.games.map(x=>x.rooms))*100}%`}}/></div></td><td>{g.rooms}</td><td>{g.started}</td><td>{g.finished}</td><td>{g.player_seats}</td><td>{g.avg_group}</td></tr>)}</tbody></table></div>{!report.games.length&&<p className={styles.empty}>No games created during this period.</p>}</section>
   <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>WHO’S PLAYING</p><h2>Players &amp; repeat play</h2></div><button onClick={exportPlayers}>Download CSV</button></div><p className={styles.note}>Self-entered names, grouped without case differences. The same name may be different people. “Last joined” is a game join, not a live presence signal. This cannot identify friends who never visited.</p><div className={styles.actions}><button aria-pressed={!showInactive} onClick={()=>setShowInactive(false)}>Played this period ({report.players.length})</button><button aria-pressed={showInactive} onClick={()=>setShowInactive(true)}>Previously seen, now inactive ({report.inactive_players.length})</button></div><p className={styles.note}>{showInactive?"These names have no game joins during the selected period. Counts show their history since the fresh start; they are not friends who never visited.":"Counts show game joins during the selected period."}</p><label className={styles.search}>Find a player<input type="search" placeholder="Search names…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className={styles.tableWrap}><table><thead><tr><th>Player name</th><th>Games joined</th><th>Games</th><th>Last joined</th></tr></thead><tbody>{people.map(p=><tr key={p.identity}><td><strong>{p.name}</strong>{p.sessions>1&&<span className={styles.tag}>REPEAT</span>}</td><td>{p.sessions}</td><td>{p.games.map(title).join(", ")}</td><td>{date(p.last_joined)}</td></tr>)}</tbody></table></div>{!people.length&&<p className={styles.empty}>No matching names in this view.</p>}</section>
   <div className={styles.twoCols}><section className={styles.panel}><p className={styles.eyebrow}>BROWSING &amp; RELIABILITY</p><h2>Devices &amp; error signals</h2><dl className={styles.facts}>{report.devices.map(d=><Fact key={d.device} label={d.device} value={`${d.visitors} browsers`}/>)}<Fact label="Reported client errors" value={num(o.errors)}/><Fact label="Bot seats (excluded from humans)" value={num(o.bot_seats)}/></dl><p className={styles.note}>Devices are estimated from screen width. Error counts are browser reports, not a complete uptime measure. Error messages and game answers aren’t collected.</p></section>
   <section className={styles.panel}><p className={styles.eyebrow}>LEAVING THE ARCADE</p><h2>Game-link clicks</h2><dl className={styles.facts}>{report.clicks.map(c=><Fact key={c.game} label={title(c.game)} value={num(c.clicks)}/>)}</dl>{!report.clicks.length&&<p className={styles.empty}>No tracked game-link clicks yet.</p>}<p className={styles.note}>Includes Host and Join clicks. For Party Bluff, The Spillway, and Blitzkrieg Chess, these are outbound clicks, not proof a game was played.</p></section></div>
   <div className={styles.twoCols}><section className={styles.panel}><p className={styles.eyebrow}>HOW THEY FOUND YOU</p><h2>Visit sources</h2><dl className={styles.facts}>{report.sources.map(s=><Fact key={s.source} label={s.source} value={`${s.visits} visits`}/>)}</dl>{!report.sources.length&&<p className={styles.empty}>Sources will appear as people visit.</p>}<p className={styles.note}>A visit can have more than one source if a visitor returns through a different link. Shared links often appear as Direct / unknown.</p></section>
   <section className={styles.panel}><p className={styles.eyebrow}>LATEST SESSIONS</p><h2>Recent games</h2><ul className={styles.recent}>{report.recent.map(r=><li key={r.id}><div><strong>{title(r.game)}</strong><small>{date(r.created_at)} · {r.players} human seats</small></div><span className={styles.tag}>{r.status}</span></li>)}</ul>{!report.recent.length&&<p className={styles.empty}>No games in this period yet.</p>}</section></div>
   <footer className={styles.footer}>All metrics use activity since the fresh start. Player names are self-entered, so they are not a verified count of people. Open rooms can be stale; “unfinished” doesn’t prove a player quit. <Link href="/privacy">Usage &amp; privacy</Link></footer>
</>;
}

function Metric({label,value,detail,accent}:{label:string;value:string;detail:string;accent:string}){return <article className={styles.metric} data-accent={accent}><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;}
function Fact({label,value}:{label:string;value:string}){return <div><dt>{label}</dt><dd>{value}</dd></div>;}
function ActivityChart({data}:{data:UsageReport['daily']}){
 const max=Math.max(1,...data.flatMap(d=>[d.rooms,d.visits]));
 return <div className={styles.chart} role="img" aria-label="Daily games and visits. Each bar has a date and count tooltip.">{data.map(d=><div className={styles.day} key={d.date} title={`${d.date}: ${d.rooms} games, ${d.visits} visits`}><div className={styles.bars}><span style={{height:`${d.rooms/max*100}%`}}/><span style={{height:`${d.visits/max*100}%`}}/></div><small>{d.date.slice(5)}</small></div>)}</div>;
}
