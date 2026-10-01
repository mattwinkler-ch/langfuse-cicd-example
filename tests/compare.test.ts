import assert from "node:assert/strict";
import test from "node:test";
import { compareRuns, markdownSummary, type CaseResult } from "../src/compare.js";
import { ticketCases } from "../src/cases.js";
import { parseQueue } from "../src/agent.js";

const passing = (): CaseResult[] => ticketCases.map(({ id, expected }) => ({ id, expected, output: expected, score: 1 }));

test("a prompt change that misroutes billing and sales is visible and fails", () => {
  const candidate = passing().map((row) => ({ ...row, output: "technical", score: row.expected === "technical" ? 1 : 0 }));
  const comparison = compareRuns(passing(), candidate);
  assert.equal(comparison.productionAccuracy, 1);
  assert.equal(comparison.candidateAccuracy, 2 / 6);
  assert.deepEqual(comparison.regressed, ["duplicate-charge", "subscription-refund", "enterprise-quote", "pricing-demo"]);
  assert.equal(comparison.passed, false);
  assert.match(markdownSummary(2, comparison), /Gate failed/);
});

test("a passing candidate clears the gate", () => assert.equal(compareRuns(passing(), passing()).passed, true));
test("incomplete evaluation cannot pass", () => assert.throws(() => compareRuns(passing(), passing().slice(1)), /incomplete/));
test("agent rejects outputs outside the routing contract", () => assert.throws(() => parseQueue("maybe billing"), /invalid queue/));
