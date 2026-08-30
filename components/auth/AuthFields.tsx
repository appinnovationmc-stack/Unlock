export function AuthFields({ handle }: { handle?: boolean }) {
  return (
    <>
      <label className="block mb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-mute">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
        />
      </label>
      <label className="block mb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-mute">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
        />
      </label>
      {handle && (
        <label className="block mb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">Handle</span>
          <input
            name="handle"
            type="text"
            placeholder="e.g. thandiwe"
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>
      )}
    </>
  );
}
