// Only coarse route names are recorded: never room codes, query strings or answers.
export function usageRoute(path: string): string | null {
  if (path === "/") return "/home";
  if (/^\/(admin|privacy)(\/|$)/.test(path)) return null;
  const parts = path.split("/").filter(Boolean);
  const games = new Set(["needle","quiz","majority","scatter","emoji","ballpark","twotruths","hottake","doodle","vibe","chain","chameleon","tv"]);
  if (!games.has(parts[0])) return null;
  return "/" + parts.slice(0, ["host","play","stage","view"].includes(parts[1]) ? 2 : 1).join("/");
}
export function deviceType(width: number) {
  return width < 640 ? "phone" : width < 1024 ? "tablet" : "desktop";
}
export const ADMIN_EMAILS = ["pokerdad123@gmail.com", "mike@spille.co"];
export function isDashboardEmail(email: string) { return ADMIN_EMAILS.includes(email.trim().toLowerCase()); }
