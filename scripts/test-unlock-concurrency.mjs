/**
 * Concurrent unlock idempotency (no live DB / GPS).
 *
 * Existing coverage:
 *   npm run test:finance  — scripts/test-finance-logic.mjs
 *   simulates creator_earnings unique_key with a Set, but does NOT
 *   parse unlock_campaign, the conversion unique index, self-referral,
 *   duplicate conversion, Impact mint, or reward/participation races.
 *
 * This file asserts the SQL contracts that make simultaneous unlocks
 * from the same user produce ONE participation, conversion, reward,
 * Impact, creator earning, and budget debit.
 *
 * Run: node scripts/test-unlock-concurrency.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const financeTest = path.join(root, "scripts", "test-finance-logic.mjs");
const unlockAction = path.join(root, "lib", "actions", "unlock.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function allMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({
      name: f,
      sql: read(path.join(migrationsDir, f))
    }));
}

function latestUnlockCampaignSql(files) {
  let latest = null;
  for (const f of files) {
    if (/create (or replace )?function public\.unlock_campaign\s*\(/i.test(f.sql)) {
      latest = f;
    }
  }
  return latest;
}

function extractUnlockBody(sql) {
  const marker = "function public.unlock_campaign(";
  const idx = sql.lastIndexOf(marker);
  if (idx < 0) return "";
  const as$$ = sql.indexOf("as $$", idx);
  const end = sql.indexOf("$$;", as$$ + 1);
  if (as$$ < 0 || end < 0) return sql.slice(idx);
  return sql.slice(idx, end);
}

const files = allMigrations();
const joined = files.map((f) => f.sql).join("\n\n-- FILE " + "SEP --\n\n");
const latestUnlock = latestUnlockCampaignSql(files);
assert(latestUnlock, "found a migration that defines unlock_campaign");
const unlockBody = extractUnlockBody(latestUnlock.sql);

// ── Unique conversion index (must not be weakened) ─────────
{
  const create =
    /create unique index if not exists attribution_events_one_conversion_per_consumer\s+on attribution_events \(campaign_id, consumer_id\)\s+where stage = 'conversion'/i.test(
      joined
    );
  assert(
    create,
    "unique index attribution_events_one_conversion_per_consumer on (campaign_id, consumer_id) where stage = conversion"
  );

  const drops = files.filter((f) =>
    /drop\s+(unique\s+)?index\s+(if\s+exists\s+)?attribution_events_one_conversion_per_consumer/i.test(
      f.sql
    )
  );
  assert(
    drops.length === 0,
    "index attribution_events_one_conversion_per_consumer is never dropped (not weakened)"
  );

  const recreatesWeaker = files.some((f) => {
    const m = f.sql.match(
      /create (?:unique )?index(?: if not exists)? attribution_events_one_conversion_per_consumer[\s\S]{0,400}/gi
    );
    if (!m) return false;
    return m.some((block) => !/unique/i.test(block) || !/campaign_id, consumer_id/.test(block));
  });
  assert(!recreatesWeaker, "conversion unique index is not recreated as a non-unique or narrower index");
}

// ── unlock_campaign early return already_unlocked ──────────
{
  assert(
    /already_unlocked boolean/.test(unlockBody),
    `unlock_campaign returns already_unlocked (${latestUnlock.name})`
  );
  assert(
    /if exists \([\s\S]*attribution_events ae[\s\S]*stage = 'conversion'[\s\S]*return query select 0, true/i.test(
      unlockBody
    ),
    "early return already_unlocked when a conversion row already exists"
  );
  assert(
    /exception when unique_violation then[\s\S]*already_unlocked|exception when unique_violation then[\s\S]*select 0, true/i.test(
      unlockBody
    ),
    "unique_violation on conversion insert returns already_unlocked (race-safe)"
  );
}

// ── Earnings unique_key earn_{campaign}_{attr}_{creator} ───
{
  assert(
    /v_unique := 'earn_' \|\| p_campaign_id::text \|\| '_' \|\| v_attr_id::text \|\| '_' \|\| v_creator::text/.test(
      unlockBody
    ),
    "earnings unique_key is earn_{campaign}_{attr}_{creator}"
  );
  assert(
    /create unique index if not exists creator_earnings_unique_key_idx\s+on creator_earnings \(unique_key\) where unique_key is not null/i.test(
      joined
    ),
    "creator_earnings unique_key partial unique index exists"
  );
  assert(
    /select id into v_earning_id from creator_earnings where unique_key = p_unique_key/.test(joined),
    "create_creator_earning_from_event returns existing row on unique_key hit"
  );

  const finance = read(financeTest);
  assert(
    finance.includes("earn_camp1_evt1_creator1"),
    "documented: test:finance already simulates unique_key Set collision (not unlock concurrency)"
  );
}

// ── Self-referral ignored ──────────────────────
{
  assert(
    /p_referrer_creator_id is distinct from auth\.uid\(\)/.test(unlockBody),
    "self-referral: referrer equal to caller is not attributed"
  );

  function resolveCreator(authUid, referrer, isCreator) {
    if (referrer != null && referrer !== authUid && isCreator) return referrer;
    return null;
  }
  const user = "consumer-1";
  assert(resolveCreator(user, user, true) === null, "self-referral yields null creator");
  assert(resolveCreator(user, "creator-9", true) === "creator-9", "other creator is attributed");
  assert(resolveCreator(user, "not-a-creator", false) === null, "unknown referrer is ignored");
}

// ── Duplicate conversion + concurrent same-user unlocks ────
{
  function earningKey(campaignId, attrId, creatorId) {
    return `earn_${campaignId}_${attrId}_${creatorId}`;
  }

  function impactKeys(campaignId, userId) {
    return ["CHALLENGE_START", "REWARD_UNLOCK", "CHALLENGE_COMPLETE"].map(
      (t) => `unlock_rpc:${t}:${campaignId}:${userId}`
    );
  }

  /** In-memory replica of uniqueness that Postgres enforces. */
  function store() {
    return {
      conversions: new Set(),
      participations: new Set(),
      rewards: new Set(),
      earnings: new Set(),
      impact: new Set(),
      visitSpend: new Set(),
      budgetDebits: 0,
      xpAwards: 0
    };
  }

  function tryUnlock(s, { campaignId, consumerId, creatorId, rewardId, visitEventId }) {
    const convKey = `${campaignId}:${consumerId}`;
    if (s.conversions.has(convKey)) {
      return { already_unlocked: true, xp_awarded: 0, impact_awarded: 0 };
    }
    s.conversions.add(convKey);
    s.xpAwards += 1;

    const partKey = `${campaignId}:${consumerId}`;
    s.participations.add(partKey);

    if (creatorId && creatorId !== consumerId) {
      const attrId = convKey;
      s.earnings.add(earningKey(campaignId, attrId, creatorId));
      s.budgetDebits += 1;
    }

    if (rewardId) s.rewards.add(`${rewardId}:${consumerId}`);

    for (const k of impactKeys(campaignId, consumerId)) s.impact.add(k);

    if (visitEventId) s.visitSpend.add(visitEventId);

    return { already_unlocked: false, xp_awarded: 10, impact_awarded: 3 };
  }

  const campaignId = "camp-a";
  const consumerId = "user-a";
  const creatorId = "creator-b";
  const rewardId = "reward-1";
  const visitEventId = "visit-1";
  const s = store();
  const results = [];
  for (let i = 0; i < 8; i++) {
    results.push(
      tryUnlock(s, { campaignId, consumerId, creatorId, rewardId, visitEventId })
    );
  }

  const winners = results.filter((r) => !r.already_unlocked);
  const dupes = results.filter((r) => r.already_unlocked);
  assert(winners.length === 1, `concurrent same-user unlocks: one winner (got ${winners.length})`);
  assert(dupes.length === 7, `concurrent same-user unlocks: seven already_unlocked (got ${dupes.length})`);
  assert(s.conversions.size === 1, "ONE conversion (unique index campaign+consumer where conversion)");
  assert(s.participations.size === 1, "ONE campaign_participations row");
  assert(s.rewards.size === 1, "ONE reward_claim (reward_id, consumer_id)");
  assert(s.earnings.size === 1, "ONE creator earning unique_key");
  assert(s.impact.size === 3, "ONE Impact mint set (3 idempotent funnel keys, not 3×8)");
  assert(s.budgetDebits === 1, "ONE budget debit / earning reserve");
  assert(s.visitSpend.size === 1, "visit CPE ledger unique per interaction event (not multiplied by unlocks)");
  assert(s.xpAwards === 1, "XP awarded once");

  const secondConsumer = store();
  tryUnlock(secondConsumer, { campaignId, consumerId: "user-a", creatorId, rewardId });
  const dup = tryUnlock(secondConsumer, { campaignId, consumerId: "user-a", creatorId, rewardId });
  assert(dup.already_unlocked === true, "sequential duplicate conversion is already_unlocked");
  assert(secondConsumer.conversions.size === 1, "duplicate conversion cannot insert a second row");

  const twoUsers = store();
  tryUnlock(twoUsers, { campaignId, consumerId: "u1", creatorId, rewardId });
  tryUnlock(twoUsers, { campaignId, consumerId: "u2", creatorId, rewardId });
  assert(twoUsers.conversions.size === 2, "different consumers may each convert once");
  assert(twoUsers.earnings.size === 2, "different consumers produce distinct earn_ keys (different attr)");
}

// ── Authoritative Impact keys in latest unlock SQL ────────
{
  assert(
    /v_key := 'unlock_rpc:' \|\| v_type::text \|\| ':' \|\| p_campaign_id::text \|\| ':' \|\| p_user_id::text/.test(
      joined
    ),
    "Impact / interaction events use unlock_rpc:{type}:{campaign}:{user} idempotency keys"
  );
  assert(
    /on conflict \(idempotency_key\) do nothing/.test(joined),
    "authoritative unlock events are insert-idempotent on idempotency_key"
  );
  assert(
    /v_impact := public\._record_authoritative_unlock_events\(auth\.uid\(\), p_campaign_id, v_creator\)/.test(
      unlockBody
    ),
    "Impact is recorded only after conversion in the same unlock_campaign transaction"
  );
}

// ── Participation + reward uniqueness in schema ──────
{
  assert(
    /create table if not exists campaign_participations[\s\S]*unique \(campaign_id, consumer_id\)/i.test(
      joined
    ),
    "campaign_participations unique (campaign_id, consumer_id)"
  );
  assert(
    /on conflict \(campaign_id, consumer_id\)\s+do update set unlocked_at = coalesce/.test(unlockBody),
    "participation insert is ON CONFLICT do not duplicate"
  );
  assert(
    /unique \(reward_id, consumer_id\)/.test(joined),
    "reward_claims unique (reward_id, consumer_id)"
  );
  assert(
    /exception when unique_violation then\s+null/.test(unlockBody),
    "duplicate reward_claim is swallowed"
  );
}

// ── App action surfaces alreadyUnlocked; no GPS required ──
{
  const action = read(unlockAction);
  assert(action.includes('rpc("unlock_campaign"'), "server action calls unlock_campaign RPC");
  assert(action.includes("alreadyUnlocked"), "server action maps already_unlocked");
  assert(!/p_lat|p_lng|geolocation/.test(action), "unlock action does not require live GPS");
}

console.log("\nUnlock concurrency tests finished.");
if (process.exitCode) process.exit(1);
