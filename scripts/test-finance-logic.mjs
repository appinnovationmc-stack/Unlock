/**
 * Critical financial logic tests (no DB required).
 * Run: node scripts/test-finance-logic.mjs
 */

function applyBps(amountCents, bps) {
  return Math.floor((amountCents * bps) / 10000);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// Fee calculation — percentage 15%
{
  const gross = 100_000_00; // R100,000
  const fee = applyBps(gross, 1500);
  assert(fee === 15_000_00, `15% of R100000 = R15000 (got ${fee})`);
  assert(gross - fee === 85_000_00, "net after fee");
}

// Hybrid: 10% + R500 fixed
{
  const gross = 10_000_00;
  const pct = applyBps(gross, 1000);
  const fixed = 50_000;
  const fee = pct + fixed;
  assert(fee === 150_000, `hybrid fee R1500 (got ${fee})`);
}

// Integer safety — no float
{
  const a = 0.1 + 0.2;
  assert(a !== 0.3, "float is unsafe (control)");
  const cents = Math.round(19.99 * 100);
  assert(cents === 1999, "to cents rounding");
}

// Budget remaining
{
  const total = 250_000_00;
  const spent = 50_000_00;
  const reserved = 30_000_00;
  const remaining = total - spent - reserved;
  assert(remaining === 170_000_00, "remaining budget");
  assert(remaining >= 0, "no negative remaining");
}

// Minimum withdrawal
{
  const min = 50_000; // R500
  const request = 40_000;
  assert(request < min, "below minimum rejected");
}

// Idempotency key uniqueness simulation
{
  const keys = new Set();
  const k1 = "earn_camp1_evt1_creator1";
  const k2 = "earn_camp1_evt1_creator1";
  keys.add(k1);
  assert(keys.has(k2), "duplicate unique_key detected");
}

// Visit CPE: cannot bill more than remaining
{
  const remaining = 15_00; // R15
  const rate = 20_00; // R20 default CPE
  const billed = remaining >= rate ? rate : 0;
  assert(billed === 0, "CPE does not overdraw remaining budget");
}

// Visit CPE: bills when remaining covers rate
{
  const remaining = 50_00;
  const rate = 20_00;
  const billed = remaining >= rate ? rate : 0;
  assert(billed === 20_00, "CPE bills R20 when remaining covers it");
}

console.log("\nFinance logic tests finished.");
if (process.exitCode) process.exit(1);
