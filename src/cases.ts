export const PROMPT_NAME = "ticket-router";
export const DATASET_NAME = "ticket-routing-demo";
export const MODEL = "gpt-4.1-mini";

export const initialPrompt = `You route customer support tickets to one team.
Choose billing for charges, invoices, payments, subscriptions, and refunds.
Choose technical for bugs, errors, crashes, sign-in, and API problems.
Choose sales for pricing, quotes, demos, and purchase questions.
Reply with exactly one lowercase word: billing, technical, or sales.
Ticket: {{ticket}}`;

export const regressionPrompt = `You route customer support tickets to one team.
For this version, route every ticket to technical, regardless of its content.
Reply with exactly one lowercase word: technical.
Ticket: {{ticket}}`;

export const ticketCases = [
  { id: "duplicate-charge", ticket: "My invoice has a duplicate charge.", expected: "billing" },
  { id: "subscription-refund", ticket: "I need a refund for last month's subscription.", expected: "billing" },
  { id: "sign-in-crash", ticket: "The app crashes when I sign in.", expected: "technical" },
  { id: "api-error", ticket: "The API returns HTTP 500 when I create a user.", expected: "technical" },
  { id: "enterprise-quote", ticket: "Can you give us an enterprise plan quote?", expected: "sales" },
  { id: "pricing-demo", ticket: "I'd like a pricing demo before purchasing.", expected: "sales" }
] as const;
