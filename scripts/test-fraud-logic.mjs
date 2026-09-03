/**
 * Adversarial fraud rules as the SQL enforces them.
 * Run: node scripts/test-fraud-logic.mjs
 * Does not hit the database. Proves the rule table, not production GPS.
 */

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

function checkinDecision({ accuracyM, distanceM, radiusM, minutesSinceLast, pins }) {
  if (accuracyM != null && accuracyM > 250) return "reject:accuracy";
  if (minutesSinceLast != null && minutesSinceLast < 10) return "reject:rate";
  if (pins > 0 && (distanceM == null || distanceM > radiusM)) return "reject:outside";
  if (pins === 0) return "verify:no_pins";
  return "verify";
}

function riskScore(reasons) {
  const w = {
    repeat_checkin_same_hour: 25,
    accuracy_gt_100m: 20,
    self_ref_attempted: 40,
    exact_pin_distance_0: 35,
    conversion_without_visit: 45,
    impossible_travel: 50
  };
  let score = 0;
  for (const r of reasons) score += w[r] ?? 0;
  return Math.min(100, score);
}

function band(score) {
  if (score <= 30) return "normal";
  if (score <= 60) return "monitor";
  if (score <= 80) return "review";
  return "block_review";
}

function kmPerHour(km, minutes) {
  if (minutes <= 0) return Infinity;
  return km / (minutes / 60);
}

assert(checkinDecision({ accuracyM: 400, distanceM: 10, radiusM: 80, minutesSinceLast: 20, pins: 1 }) === "reject:accuracy", "accuracy > 250m rejected");
assert(checkinDecision({ accuracyM: 20, distanceM: 10, radiusM: 80, minutesSinceLast: 4, pins: 1 }) === "reject:rate", "repeat < 10 min rejected");
assert(checkinDecision({ accuracyM: 20, distanceM: 200, radiusM: 80, minutesSinceLast: 20, pins: 1 }) === "reject:outside", "outside radius rejected");
assert(checkinDecision({ accuracyM: 20, distanceM: 12, radiusM: 80, minutesSinceLast: 20, pins: 1 }) === "verify", "clean pin check-in verified");
assert(checkinDecision({ accuracyM: 20, distanceM: null, radiusM: 80, minutesSinceLast: 20, pins: 0 }) === "verify:no_pins", "no-pin campaign does not visit-price");

assert(riskScore(["repeat_checkin_same_hour"]) === 25, "repeat hour = 25");
assert(riskScore(["self_ref_attempted"]) === 40, "self-ref = 40");
assert(riskScore(["conversion_without_visit"]) === 45, "unlock without visit = 45");
assert(riskScore(["impossible_travel"]) === 50, "impossible travel = 50");
assert(riskScore(["repeat_checkin_same_hour", "accuracy_gt_100m", "exact_pin_distance_0"]) === 80, "stacked signals hit review");
assert(band(25) === "normal", "0-30 normal");
assert(band(55) === "monitor", "31-60 monitor");
assert(band(70) === "review", "61-80 review");
assert(band(90) === "block_review", "81-100 block review");

assert(kmPerHour(400, 15) > 900, "400km in 15 min is impossible");
assert(kmPerHour(2, 20) < 50, "2km in 20 min is normal");

assert(riskScore(["self_ref_attempted"]) < 70, "self-ref alone does not auto-accuse");
assert(riskScore(["impossible_travel", "self_ref_attempted"]) >= 70, "travel + self-ref forces review");

console.log("\nFraud logic tests finished.");
if (process.exitCode) process.exit(1);
