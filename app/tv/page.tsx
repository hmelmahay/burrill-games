import CodeInput from "./CodeInput";

// One bookmarkable address for the big screen: type the room code and the
// form GETs /tv/go, which looks the room up server-side and redirects to the
// right game's host screen in read-only ?tv=1 mode. Room codes are unique
// across every game, so the code alone is enough.
//
// Deliberately a server component with a plain HTML form: some TV browsers
// never manage to run our JS bundle, and this page is the one they must not
// break on. Errors round-trip through ?err= so they render without JS too.
const ERRORS: Record<string, string> = {
  short: "Room codes are 4 characters.",
  ended: "That game already ended.",
  notfound: "No room with that code. Double-check it?",
  lookup: "Couldn't reach the game server — check the TV's internet and try again.",
};

export default async function TvEntry({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; code?: string }>;
}) {
  const { err, code } = await searchParams;
  const errMsg = err ? ERRORS[err] ?? ERRORS.notfound : null;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="text-5xl">📺</div>
      <h1 className="text-3xl font-extrabold text-center">Big-screen scoreboard</h1>
      <p className="text-fog text-center max-w-sm">
        Enter the room code from the host&apos;s screen. This TV becomes the room&apos;s
        scoreboard — no buttons, no spoilers, works for every game.
      </p>
      <form action="/tv/go" method="get" className="flex flex-col items-center gap-4">
        <CodeInput initialCode={code ?? ""} />
        <button
          type="submit"
          className="rounded-xl bg-glow px-8 py-4 text-lg font-bold text-[#1a1000] transition hover:brightness-110"
        >
          Open scoreboard →
        </button>
      </form>
      {errMsg && <p className="text-lose text-center">{errMsg}</p>}
      <p className="text-fog text-xs text-center max-w-xs">
        Tip: bookmark this page on your TV — the address never changes.
      </p>
    </main>
  );
}
