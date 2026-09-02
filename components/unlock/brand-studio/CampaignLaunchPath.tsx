import { Button } from "@/components/ui/Button";
import { updateCampaignStatus } from "@/lib/actions/campaigns";
import Link from "next/link";

export type CampaignLaunchState = {
  id: string;
  status: string;
  hasPin: boolean;
  hasReward: boolean;
  hasBudget: boolean;
};

function StepMark({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={done ? "text-fog" : "text-mute"}>
      {done ? "done" : "next"} · {label}
    </span>
  );
}

export function CampaignLaunchPath({ campaign }: { campaign: CampaignLaunchState }) {
  const isLive = campaign.status === "live";
  const isPaused = campaign.status === "paused";
  const isEnded = campaign.status === "ended";
  const canPublish = campaign.hasPin && campaign.hasReward;

  if (isLive || isPaused) {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[10px] tracking-wide text-mute">
          {isLive ? "This campaign is live" : "This campaign is paused"}. Open live to watch visits — not the builder.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/studio/live/${campaign.id}`}>
            <Button variant="volt" className="px-3 py-1.5">
              Open live
            </Button>
          </Link>
          <Link href={`/campaign/${campaign.id}`}>
            <Button variant="ghost" className="px-3 py-1.5">
              Preview
            </Button>
          </Link>
          {isLive && (
            <form action={updateCampaignStatus}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <input type="hidden" name="status" value="paused" />
              <Button type="submit" variant="ghost" className="px-3 py-1.5">
                Pause
              </Button>
            </form>
          )}
          {isPaused && (
            <form action={updateCampaignStatus}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <input type="hidden" name="status" value="live" />
              <Button type="submit" variant="ghost" className="px-3 py-1.5">
                Resume
              </Button>
            </form>
          )}
          <form action={updateCampaignStatus}>
            <input type="hidden" name="campaign_id" value={campaign.id} />
            <input type="hidden" name="status" value="ended" />
            <Button type="submit" variant="ghost" className="px-3 py-1.5">
              End
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (isEnded) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href={`/studio/live/${campaign.id}`}>
          <Button variant="ghost" className="px-3 py-1.5">
            Open live
          </Button>
        </Link>
        <form action={updateCampaignStatus}>
          <input type="hidden" name="campaign_id" value={campaign.id} />
          <input type="hidden" name="status" value="archived" />
          <Button type="submit" variant="ghost" className="px-3 py-1.5">
            Archive
          </Button>
        </form>
      </div>
    );
  }

  const nextCopy = !campaign.hasPin
    ? "Draft only. Add a location pin before this can go live."
    : !campaign.hasReward
      ? "Draft only. Name the reward people unlock before this can go live."
      : !campaign.hasBudget
        ? "Pin and reward are set. Fund a budget, preview, then publish."
        : "Ready. Preview as a customer, then publish to go live.";

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] tracking-wide flex flex-wrap gap-x-3 gap-y-1">
        <StepMark done={campaign.hasPin} label="pin" />
        <StepMark done={campaign.hasReward} label="reward" />
        <StepMark done={campaign.hasBudget} label="fund" />
        <StepMark done={false} label="publish" />
        <StepMark done={false} label="live" />
      </p>
      <p className="text-sm text-mute">{nextCopy}</p>
      <div className="flex flex-wrap gap-2">
        {!campaign.hasPin && (
          <Link href={`#add-pin`}>
            <Button variant="volt" className="px-3 py-1.5">
              Add a pin
            </Button>
          </Link>
        )}
        {campaign.hasPin && !campaign.hasReward && (
          <Link href={`#add-reward`}>
            <Button variant="volt" className="px-3 py-1.5">
              Add a reward
            </Button>
          </Link>
        )}
        {canPublish && !campaign.hasBudget && (
          <Link href="/billing">
            <Button variant="volt" className="px-3 py-1.5">
              Fund
            </Button>
          </Link>
        )}
        {canPublish && (
          <form action={updateCampaignStatus}>
            <input type="hidden" name="campaign_id" value={campaign.id} />
            <input type="hidden" name="status" value="live" />
            <Button
              type="submit"
              variant={campaign.hasBudget ? "volt" : "ghost"}
              className="px-3 py-1.5"
            >
              Publish
            </Button>
          </form>
        )}
        <Link href={`/campaign/${campaign.id}`}>
          <Button variant="ghost" className="px-3 py-1.5">
            Preview
          </Button>
        </Link>
      </div>
    </div>
  );
}
