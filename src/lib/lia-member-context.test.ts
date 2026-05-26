import assert from "node:assert/strict";
import {
  casualEntitled,
  casualRemaining,
  getHalfYearPeriod,
  sickEntitledPerHalf,
  sickRemaining,
} from "./leave-policy";

/** Mirrors leave bank math used in lia-member-context (no DB). */
function sampleLeaveLines(opts: {
  probationEndsAt: Date | null;
  joinedAt: Date;
  refDate: Date;
  casualUsed: number;
  sickUsed: number;
}) {
  const { periodYear, half } = getHalfYearPeriod(opts.refDate);
  const halfLabel = half === 1 ? "Jan–Jun" : "Jul–Dec";
  const casualEnt = casualEntitled(opts.probationEndsAt, opts.joinedAt, opts.refDate);
  const casualRem = casualRemaining({
    probationEndsAt: opts.probationEndsAt,
    joinedAt: opts.joinedAt,
    refDate: opts.refDate,
    casualUsed: opts.casualUsed,
  });
  const sickEnt = sickEntitledPerHalf(opts.probationEndsAt, opts.refDate);
  const sickRem = sickRemaining({
    probationEndsAt: opts.probationEndsAt,
    refDate: opts.refDate,
    sickUsed: opts.sickUsed,
  });
  return { halfLabel, periodYear, casualEnt, casualRem, sickEnt, sickRem };
}

const ref = new Date("2026-05-15");
const joined = new Date("2024-01-10");
const probationEnd = new Date("2024-06-30");

const confirmed = sampleLeaveLines({
  probationEndsAt: probationEnd,
  joinedAt: joined,
  refDate: ref,
  casualUsed: 1,
  sickUsed: 0.5,
});

assert.equal(confirmed.halfLabel, "Jan–Jun");
assert.ok(confirmed.casualRem >= 0);
assert.ok(confirmed.sickRem >= 0);
assert.equal(confirmed.sickEnt, 3);

const onProbation = sampleLeaveLines({
  probationEndsAt: new Date("2026-12-31"),
  joinedAt: joined,
  refDate: ref,
  casualUsed: 0,
  sickUsed: 0,
});

assert.equal(onProbation.casualEnt, 0);
assert.equal(onProbation.sickEnt, 0);

console.log("lia-member-context: ok");
