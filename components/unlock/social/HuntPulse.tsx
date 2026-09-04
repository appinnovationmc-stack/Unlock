export function HuntPulse({
  hunting,
  unlocked,
  lastUnlockAt,
  endsAt
}: {
  hunting: number;
  unlocked: number;
  lastUnlockAt: string | null;
  endsAt?: string | null;
}) {
  const last =
    lastUnlockAt && Date.parse(lastUnlockAt)
      ? relative(Date.parse(lastUnlockAt))
      : null;
  const remaining = endsAt && Date.parse(endsAt) ? until(Date.parse(endsAt)) : null;

  return (
    <div className="space-y-1 text-sm text-mute">
      {hunting > 0 ? (
        <p>
          {hunting} {hunting === 1 ? "person is" : "people are"} hunting this
        </p>
      ) : (
        <p>Be first on the hunt.</p>
      )}
      {unlocked > 0 ? (
        <p>
          {unlocked} unlocked{last ? ` · last ${last}` : ""}
        </p>
      ) : last ? (
        <p>Someone unlocked this {last}</p>
      ) : null}
      {remaining ? <p>Ends {remaining}</p> : null}
    </div>
  );
}

function relative(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function until(ts: number) {
  const s = Math.round((ts - Date.now()) / 1000);
  if (s <= 0) return "soon";
  if (s < 3600) return `in ${Math.round(s / 60)} min`;
  if (s < 86400) return `in ${Math.round(s / 3600)}h`;
  return `in ${Math.round(s / 86400)}d`;
}
