import { LangfuseClient } from "@langfuse/client";
import { DATASET_NAME, initialPrompt, PROMPT_NAME, ticketCases } from "../src/cases.js";

async function main() {
  const langfuse = new LangfuseClient();
  await langfuse.api.datasets.create({
    name: DATASET_NAME,
    description: "Six fixed ticket routing cases for comparing prompt versions in CI"
  });
  for (const item of ticketCases) {
    await langfuse.dataset.createItem({
      id: `ticket-routing-demo-${item.id}`,
      datasetName: DATASET_NAME,
      input: { ticket: item.ticket },
      expectedOutput: item.expected,
      metadata: { case_id: item.id }
    });
  }
  const prompt = await langfuse.prompt.create({
    name: PROMPT_NAME,
    type: "text",
    prompt: initialPrompt,
    labels: ["production"]
  });
  console.log(`Created dataset ${DATASET_NAME} with ${ticketCases.length} cases.`);
  console.log(`Created ${PROMPT_NAME} v${prompt.version} with the production label.`);
  console.log("Run this setup only once. A second prompt.create call creates another version.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
