const mechanics = [
  "quiz", "puzzle", "riddle", "treasure_hunt", "qr_scan", "nfc_tap",
  "geolocation", "timed_challenge", "social_action", "referral"
];

export function MechanicPicker() {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {mechanics.map((m) => (
        <label
          key={m}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-mute bg-ink2 border border-white/10 px-2.5 py-1.5 cursor-pointer has-[:checked]:border-volt has-[:checked]:text-volt"
        >
          <input type="checkbox" name="mechanics" value={m} className="accent-volt" />
          {m.replace("_", " ")}
        </label>
      ))}
    </div>
  );
}
