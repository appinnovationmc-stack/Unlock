import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { UnlockMark } from "@/components/ui/UnlockMark";

export default function ForYouPage() {
  return (
    <main className="page-shell min-h-screen">
      <UnlockMark size={40} />
      <h1 className="font-display text-4xl md:text-6xl text-fog tracking-tight mt-6">
        Don&apos;t just see the ad.
        <br />
        Unlock it.
      </h1>
      <p className="text-mute text-lg mt-4 max-w-md">
        Brands hide moments in the city. You walk to them. You hold. You take what they left.
      </p>
      <ol className="mt-10 space-y-6">
        {[
          ["Find it", "The map is the media. Pins are real places."],
          ["Get close", "Walk there. The phone knows when you arrive."],
          ["Unlock it", "Hold. The reward is yours. Not a coupon book."],
          ["See your numbers", "Every visit and unlock is on your profile. Yours only."]
        ].map(([t, d]) => (
          <li key={t}>
            <p className="font-display text-xl text-fog">{t}</p>
            <p className="text-mute text-sm mt-1">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/discover">
          <Button variant="volt">Open the map</Button>
        </Link>
        <Link href="/signup">
          <Button variant="ghost">Create account</Button>
        </Link>
      </div>
    </main>
  );
}
