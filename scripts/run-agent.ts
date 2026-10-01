import { LangfuseClient } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { routeTicket } from "../src/agent.js";
import { PROMPT_NAME } from "../src/cases.js";

async function main() {
  const ticket = process.argv.slice(2).join(" ").trim();
  if (!ticket) throw new Error('Pass a ticket, for example: npm run agent -- "My invoice is wrong"');
  const otel = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
  otel.start();
  try {
    const langfuse = new LangfuseClient();
    const prompt = await langfuse.prompt.get(PROMPT_NAME, { type: "text", label: "production" });
    const queue = await routeTicket(ticket, prompt);
    console.log(`Prompt ${PROMPT_NAME} v${prompt.version} routed the ticket to ${queue}.`);
  } finally {
    await otel.shutdown();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
