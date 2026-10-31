export type UsageReport = {
 days: number; generated_at: string; tracking_since: string | null;
 overview: {visitors:number;visits:number;page_views:number;returning_browsers:number;active_browsers:number;rooms:number;started:number;finished:number;unfinished:number;player_names:number;player_seats:number;repeat_names:number;bot_seats:number;avg_group:number|null;avg_visit_minutes:number|null;avg_game_minutes:number|null;timed_games:number;errors:number};
 games: {game:string;rooms:number;started:number;finished:number;unfinished:number;player_seats:number;avg_group:number}[];
 players: {identity:string;name:string;sessions:number;last_joined:string;games:string[]}[];
 daily: {date:string;rooms:number;visits:number}[];
 devices:{device:string;visitors:number}[];
 sources:{source:string;visits:number}[];
 clicks:{game:string;clicks:number}[];
 recent:{id:string;game:string;status:string;created_at:string;players:number}[];
};
export function percentage(n:number,d:number) { return d ? Math.round(n/d*100) : null; }
// Escape spreadsheet formulas as well as CSV quotes before exporting entered names.
export function csvCell(value:unknown) {
 let text=String(value??"");
 if (/^[\s]*[=+\-@\t\r]/.test(text)) text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function playersCsv(players:UsageReport['players']) {
 return [["Player name","Games joined","Last joined","Games"],...players.map(p=>[p.name,p.sessions,p.last_joined,p.games.join("; ")])].map(row=>row.map(csvCell).join(",")).join("\r\n");
}
