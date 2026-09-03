import { draftDrop } from "./draft-drop";

export type DropPlan = {
  walkers: number;
  unlocks: number;
  visits: number;
  firstDrop: boolean;
  stock: number;
  intent: string;
  where: string;
  rewardKind: string;
  title: string;
  tagline: string;
  rewardLabel: string;
  note: string;
};

/**
 * Plan from measured people, not from a prompt.
 * First drop: small cap, visit, map is the media.
 * Next drop: only as many rewards as a fraction of known walkers.
 */
export function planDropFromAudience(input: {
  walkers: number;
  unlocks: number;
  visits: number;
}): DropPlan {
  const walkers = Math.max(0, input.walkers || 0);
  const unlocks = Math.max(0, input.unlocks || 0);
  const visits = Math.max(0, input.visits || 0);
  const firstDrop = walkers === 0 && unlocks === 0;

  const intent = visits >= unlocks && visits > 0 ? "VISIT" : walkers > 0 ? "VISIT" : "COLLECT";
  const where = "STORES";
  const rewardKind = firstDrop ? "MYSTERY" : "DISCOUNT";
  const copy = draftDrop(intent, where, rewardKind);

  let stock = 20;
  if (!firstDrop) {
    stock = Math.max(8, Math.min(80, Math.round(walkers * 0.3) || 8));
  }

  const note = firstDrop
    ? "No audience yet. Plant one pin. Cap the reward. The map finds the first walkers."
    : `${walkers} people already moved for you. Cap this drop at ${stock} so the next one is scarce. Ping those walkers — not a cold list.`;

  return {
    walkers,
    unlocks,
    visits,
    firstDrop,
    stock,
    intent,
    where,
    rewardKind,
    title: firstDrop ? "First drop" : copy.title,
    tagline: firstDrop ? "Get close. Hold. Take it." : copy.tagline,
    rewardLabel: firstDrop ? "One of twenty" : copy.rewardLabel,
    note
  };
}
