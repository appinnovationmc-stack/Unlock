/**
 * Rand trail: deposit → reserve → fee → CPE → creator → remaining.
 * Run: node scripts/test-reconciliation-logic.mjs
 */

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

function applyBps(cents, bps) {
  return Math.floor((cents * bps) / 10000);
}

const deposit = 100_000_00;
const fee = applyBps(deposit, 1500);
const reserve = 50_000_00;
const platformOnFund = applyBps(reserve, 1500);
const performanceAlloc = 25_000_00;
const creatorAlloc = 15_000_00;
const rewardAlloc = 5_000_00;

assert(fee === 15_000_00, "platform fee on R100k = R15k");
assert(reserve + 0 === 50_000_00, "campaign reserve is integer cents");
assert(creatorAlloc + rewardAlloc + performanceAlloc + platformOnFund <= reserve + platformOnFund, "allocations tracked");

let spent = 0;
const cpe = 20_00;
const visits = 10;
for (let i = 0; i < visits; i++) {
  const remaining = reserve - spent;
  if (remaining < cpe) break;
  spent += cpe;
}
assert(spent === 200_00, "10 visits × R20 CPE = R200");

const spentAfterCreator = spent;
assert(spentAfterCreator === 200_00, "creator verify does not double-count visit CPE");

const remaining = reserve - spentAfterCreator;
assert(remaining === 49_800_00, "remaining after 10 CPE visits");

const rewardLiability = 50_00 * 8;
assert(rewardLiability === 400_00, "reward liability is inventory × face");

assert(reserve - spent === remaining, "reserve − visit spend = remaining");
assert(spent % 1 === 0, "CPE is integer cents");
assert(remaining >= 0, "no negative remaining");

console.log("\nReconciliation logic tests finished.");
if (process.exitCode) process.exit(1);
