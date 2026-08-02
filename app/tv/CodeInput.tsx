"use client";

// Enhancement only: uppercases as you type and auto-submits the surrounding
// form on the 4th character. The form itself is a plain GET to /tv/go, so if
// this never hydrates (old TV browsers), typing + the submit button still work.
export default function CodeInput({ initialCode }: { initialCode: string }) {
  return (
    <input
      name="code"
      defaultValue={initialCode}
      onChange={(e) => {
        const c = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        e.target.value = c;
        if (c.length === 4) e.target.form?.requestSubmit();
      }}
      placeholder="CODE"
      maxLength={4}
      autoFocus
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      className="rounded-xl border-2 border-glow bg-card px-4 py-5 text-center text-4xl font-mono tracking-[0.3em] uppercase placeholder:text-fog/40 w-64"
    />
  );
}
