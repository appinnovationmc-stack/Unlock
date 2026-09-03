export function UnlockMark({
  size = 28,
  className = ""
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/unlock-mark.svg"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
    />
  );
}
