import Link from "next/link";

export function HonestEmpty({
  title,
  body,
  href,
  action
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="border border-white/10 px-5 py-10">
      <p className="font-display text-xl text-fog">{title}</p>
      <p className="text-mute text-sm mt-2 max-w-md">{body}</p>
      {href && action ? (
        <Link href={href} className="inline-block mt-4 text-sm text-volt">
          {action}
        </Link>
      ) : null}
    </div>
  );
}

export function HonestError({
  body,
  href,
  action = "Retry"
}: {
  body: string;
  href: string;
  action?: string;
}) {
  return (
    <div className="border border-white/15 px-5 py-8">
      <p className="text-fog text-sm">{body}</p>
      <Link href={href} className="inline-block mt-3 text-sm text-volt">
        {action}
      </Link>
    </div>
  );
}
