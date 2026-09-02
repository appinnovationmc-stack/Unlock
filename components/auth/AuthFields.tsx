export function AuthFields({ handle }: { handle?: boolean }) {
  const label = "block text-sm text-mute mb-1";
  const input =
    "w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog text-base outline-none";

  return (
    <>
      <label className="block mb-4">
        <span className={label}>Email</span>
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className="block mb-4">
        <span className={label}>Password</span>
        <input name="password" type="password" required minLength={6} className={input} />
      </label>
      {handle && (
        <label className="block mb-4">
          <span className={label}>Handle</span>
          <input name="handle" type="text" placeholder="e.g. thandiwe" className={input} />
        </label>
      )}
    </>
  );
}
