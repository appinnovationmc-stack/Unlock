export function XPBadge({ xp }: { xp: number }) {
  return (
    <span className="inline-flex items-center font-body text-sm text-mute">
      {xp.toLocaleString()} XP
    </span>
  );
}
