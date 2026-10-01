import { ticketCases } from "./cases.js";

export type CaseResult = { id: string; expected: string; output: string | null; score: number | null };

export function compareRuns(production: CaseResult[], candidate: CaseResult[]) {
  const expectedIds = new Set<string>(ticketCases.map((item) => item.id));
  const toMap = (rows: CaseResult[], label: string) => {
    const result = new Map<string, CaseResult>();
    for (const row of rows) {
      if (!expectedIds.has(row.id) || result.has(row.id)) throw new Error(`${label} has an unknown or duplicate case: ${row.id}`);
      if (row.score !== 0 && row.score !== 1) throw new Error(`${label} has a missing or invalid score: ${row.id}`);
      result.set(row.id, row);
    }
    if (result.size !== expectedIds.size) throw new Error(`${label} has incomplete results`);
    return result;
  };
  const before = toMap(production, "Production");
  const after = toMap(candidate, "Candidate");
  const rows = ticketCases.map(({ id, expected }) => {
    const old = before.get(id)!;
    const next = after.get(id)!;
    if (old.expected !== expected || next.expected !== expected) throw new Error(`Dataset expected output changed for ${id}`);
    return { id, expected, production: old.output, candidate: next.output, productionScore: old.score!, candidateScore: next.score! };
  });
  const productionAccuracy = rows.reduce((sum, row) => sum + row.productionScore, 0) / rows.length;
  const candidateAccuracy = rows.reduce((sum, row) => sum + row.candidateScore, 0) / rows.length;
  const regressed = rows.filter((row) => row.productionScore === 1 && row.candidateScore === 0).map((row) => row.id);
  return { rows, productionAccuracy, candidateAccuracy, regressed, passed: regressed.length === 0 && candidateAccuracy === 1 };
}

export function markdownSummary(version: number, comparison: ReturnType<typeof compareRuns>): string {
  const lines = [
    `## Ticket routing: candidate v${version} vs production`,
    "",
    `Production accuracy: **${(comparison.productionAccuracy * 100).toFixed(0)}%** · Candidate accuracy: **${(comparison.candidateAccuracy * 100).toFixed(0)}%**`,
    "",
    "| Case | Expected | Production | Candidate | Result |",
    "| --- | --- | --- | --- | --- |"
  ];
  for (const row of comparison.rows) {
    lines.push(`| ${row.id} | ${row.expected} | ${row.production ?? "ERROR"} | ${row.candidate ?? "ERROR"} | ${row.candidateScore === 1 ? "Pass" : "Fail"} |`);
  }
  lines.push("", comparison.passed ? "**Gate passed**" : `**Gate failed**: ${comparison.regressed.length ? `new failures in ${comparison.regressed.join(", ")}` : "candidate did not pass all cases"}`, "");
  return lines.join("\n");
}
