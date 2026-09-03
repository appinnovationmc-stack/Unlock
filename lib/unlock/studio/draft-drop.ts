export type DropDraft = {
  title: string;
  tagline: string;
  rewardLabel: string;
};

/** Instant copy so a brand does not stare at empty fields. */
export function draftDrop(intent: string, where: string, rewardKind: string): DropDraft {
  const place =
    where === "STORES"
      ? "the store"
      : where === "PRODUCTS"
        ? "the product"
        : where === "ONLINE"
          ? "the page"
          : "the city";

  if (intent === "VISIT") {
    return {
      title: `Come to ${place}`,
      tagline: "Get close. You're here. Hold.",
      rewardLabel: rewardKind === "DISCOUNT" ? "20% if you show up" : "Yours if you arrive"
    };
  }
  if (intent === "COLLECT") {
    return {
      title: `Find it in ${place}`,
      tagline: "Hunt it. Scan it. Take it.",
      rewardLabel: rewardKind === "MYSTERY" ? "Mystery drop" : "One of a few"
    };
  }
  if (intent === "BUY") {
    return {
      title: "Buy it where it lives",
      tagline: "The receipt is the key.",
      rewardLabel: rewardKind === "CASH" ? "Money back" : "Something extra"
    };
  }
  if (intent === "SHARE") {
    return {
      title: "Bring someone",
      tagline: "They come. You both unlock.",
      rewardLabel: "Two get in"
    };
  }
  return {
    title: "Something is waiting",
    tagline: "Find it. Get close. Unlock it.",
    rewardLabel: rewardKind === "ACCESS" ? "You're on the list" : "It's yours"
  };
}
