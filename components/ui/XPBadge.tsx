export function XPBadge({ xp }: { xp: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-volt bg-ink2/80 px-3 py-1 rounded-full border border-volt/30">
      <span className="w-1.5 h-1.5 rounded-full bg-volt animate-pulse" />
      {xp.toLocaleString()} XP
    </span>
  );
}
