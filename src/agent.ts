import type { TextPromptClient } from "@langfuse/client";
import { observeOpenAI } from "@langfuse/openai";
import OpenAI from "openai";
import { MODEL } from "./cases.js";

export type Queue = "billing" | "technical" | "sales";

export function parseQueue(value: string): Queue {
  const queue = value.trim().toLowerCase();
  if (queue === "billing" || queue === "technical" || queue === "sales") return queue;
  throw new Error(`Agent returned an invalid queue: ${JSON.stringify(value)}`);
}

// Illustrative tool: a real agent would create or update a ticket here.
export function createTicket(queue: Queue, ticket: string) {
  return { queue, ticket, status: "created" as const };
}

export async function routeTicket(ticket: string, prompt: TextPromptClient): Promise<Queue> {
  const client = observeOpenAI(new OpenAI(), { langfusePrompt: prompt });
  const response = await client.responses.create({
    model: MODEL,
    temperature: 0,
    input: prompt.compile({ ticket })
  });
  const selectedQueue = parseQueue(response.output_text);
  return createTicket(selectedQueue, ticket).queue;
}
