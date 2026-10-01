import { appendFile } from "node:fs/promises";
import { LangfuseClient, type Evaluation, type Evaluator, type RunEvaluator } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { routeTicket } from "../src/agent.js";
import { DATASET_NAME, PROMPT_NAME } from "../src/cases.js";
import { compareRuns, markdownSummary, type CaseResult } from "../src/compare.js";

const exactRoute: Evaluator = async ({ output, expectedOutput }) => ({
  name: "route_accuracy",
  value: output === expectedOutput ? 1 : 0
});

const averageAccuracy: RunEvaluator = async ({ itemResults }) => {
  const scores = itemResults.flatMap((item) => item.evaluations)
    .filter((score) => score.name === "route_accuracy" && typeof score.value === "number")
    .map((score) => score.value as number);
  return {
    name: "average_route_accuracy",
    value: scores.length === itemResults.length && scores.length > 0
      ? scores.reduce((sum, value) => sum + value, 0) / scores.length
      : 0
  };
};

function readVersion(): number {
  const raw = process.env.CANDIDATE_VERSION;
  const version = Number(raw);
  if (!raw || !Number.isSafeInteger(version) || version < 1) {
    throw new Error("Set CANDIDATE_VERSION to the positive integer version from Langfuse.");
  }
  return version;
}

function extractRows(result: { itemResults: Array<{ item: { metadata?: unknown; expectedOutput?: unknown }; output?: unknown; evaluations: Evaluation[] }> }): CaseResult[] {
  return result.itemResults.map(({ item, output, evaluations }) => {
    const caseId = (item.metadata as { case_id?: unknown } | undefined)?.case_id;
    const matches = evaluations.filter((evaluation) => evaluation.name === "route_accuracy");
    if (typeof caseId !== "string" || matches.length !== 1) throw new Error("An experiment item has no case ID or route score.");
    return {
      id: caseId,
      expected: String(item.expectedOutput),
      output: typeof output === "string" ? output : null,
      score: typeof matches[0].value === "number" ? matches[0].value : null
    };
  });
}

async function main() {
  const version = readVersion();
  const otel = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
  otel.start();
  try {
    const langfuse = new LangfuseClient();
    const dataset = await langfuse.dataset.get(DATASET_NAME);
    const productionPrompt = await langfuse.prompt.get(PROMPT_NAME, { type: "text", label: "production" });
    const candidatePrompt = await langfuse.prompt.get(PROMPT_NAME, { type: "text", version });
    const metadata = { git_sha: process.env.GITHUB_SHA ?? "local", candidate_prompt_version: version };

    const production = await dataset.runExperiment({
      name: `ticket router production v${productionPrompt.version} / ${metadata.git_sha}`,
      task: async (item) => routeTicket((item.input as { ticket: string }).ticket, productionPrompt),
      evaluators: [exactRoute],
      runEvaluators: [averageAccuracy],
      metadata: { ...metadata, variant: "production", prompt_version: productionPrompt.version }
    });
    const candidate = await dataset.runExperiment({
      name: `ticket router candidate v${candidatePrompt.version} / ${metadata.git_sha}`,
      task: async (item) => routeTicket((item.input as { ticket: string }).ticket, candidatePrompt),
      evaluators: [exactRoute],
      runEvaluators: [averageAccuracy],
      metadata: { ...metadata, variant: "candidate", prompt_version: candidatePrompt.version }
    });

    const comparison = compareRuns(extractRows(production), extractRows(candidate));
    const summary = markdownSummary(version, comparison);
    console.log(summary);
    console.log(await production.format());
    console.log(await candidate.format());
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    if (!comparison.passed) process.exitCode = 1;
  } finally {
    await otel.shutdown();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
