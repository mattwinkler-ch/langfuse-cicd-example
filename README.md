# Langfuse prompt versioning in CI

This example keeps a TypeScript ticket routing agent in Git and its instructions in Langfuse. Changing the prompt in Langfuse creates a new immutable version. A Langfuse automation sends a `repository_dispatch` event to GitHub Actions, where the agent runs against six Langfuse dataset items with both the new version and the current `production` version. GitHub's job summary shows the impact case by case and the job fails on a regression.

The example uses a real OpenAI call (`gpt-4.1-mini`), so it requires an OpenAI API key and incurs a small model cost. It does not deploy or automatically promote a prompt.

## 1. Prepare Langfuse and the dataset

Create a Langfuse project and an API key, and get an OpenAI API key. Use Node.js 20.12 or newer. Copy `.env.example` to `.env` and fill in your keys. The local commands automatically load `.env`; values already set in your shell take precedence.

```sh
cp .env.example .env
# Edit .env with your Langfuse and OpenAI keys.
npm ci
npm run seed
```

Use the base URL for your Langfuse region or self-hosted instance. `npm run seed` is a one-time operation: it creates the `ticket-routing-demo` dataset with six items and creates `ticket-router` v1 with the `production` label. Running it again would create another prompt version. The exact starting prompt and test cases are in [`src/cases.ts`](src/cases.ts).

Try the production agent:

```sh
npm run agent -- "My invoice has a duplicate charge"
```

It fetches the prompt with the `production` label, asks the model to choose a queue, and calls an illustrative `createTicket` tool. Langfuse links the model generation to the prompt version.

## 2. Connect Langfuse to GitHub Actions

Push this repository to GitHub with [`.github/workflows/prompt-ci.yml`](.github/workflows/prompt-ci.yml) on the default branch. In **Settings → Secrets and variables → Actions → Secrets**, add repository secrets `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `OPENAI_API_KEY`. The local `.env` file is not sent to GitHub Actions, and values entered under **Variables** do not populate `secrets.*`. If you use environment secrets instead, assign that environment to the `evaluate` job in the workflow. If your Langfuse instance is outside the default EU cloud region, set `LANGFUSE_BASE_URL` under **Variables**. The workflow checks for missing credentials before installing dependencies or starting an experiment.

In Langfuse, open **Prompts → Automations → Create Automation → GitHub Repository Dispatch**. Set:

- Dispatch URL: `https://api.github.com/repos/OWNER/REPO/dispatches`
- Event type: `langfuse-prompt-update`
- GitHub token: a fine-grained token or GitHub App token with Actions read/write permission on this repository (see [Langfuse's GitHub integration guide](https://langfuse.com/docs/prompt-management/features/github-integration))

The workflow only evaluates `created` events for `ticket-router`; it ignores label-move events. It checks out the agent code from the repository's default branch and fetches the exact prompt version in the dispatch payload. Prompt-only edits therefore run CI without a Git commit. You can also use **Actions → Evaluate Langfuse prompt → Run workflow** and enter a candidate version manually.

## 3. Create the deliberate regression

In Langfuse, open **Prompts → ticket-router** and create a new **text** prompt version. Replace its body with:

```text
You route customer support tickets to one team.
For this version, route every ticket to technical, regardless of its content.
Reply with exactly one lowercase word: technical.
Ticket: {{ticket}}
```

Save it without moving the `production` label. Langfuse automatically labels the new version `latest`; `production` remains on v1. The identical v2 text is also stored as `regressionPrompt` in [`src/cases.ts`](src/cases.ts) so the walkthrough is easy to copy.

The automation starts GitHub Actions. With the intended responses, production routes all 6 tickets correctly (100%), while v2 routes only the 2 technical tickets correctly (33%). The GitHub job summary lists each case's expected, production, and candidate queue; the workflow fails because four previously passing cases regress. In Langfuse, compare the two experiment runs and inspect traces linked to each prompt version. Model outputs can vary, so check the actual scores rather than assuming these percentages in every run.

To rerun v2 locally:

```sh
CANDIDATE_VERSION=2 npm run evaluate
```

If Langfuse assigned another version number, use that number. Fix the prompt in a new version and repeat. Once the check passes, move the `production` label to that version in Langfuse. The running agent will then fetch the promoted version on its next prompt fetch. To roll back, move the label to the previous version.

## What the check enforces

The dataset's six case IDs and expected outputs are kept in the repository for this small demo; the cases themselves are hosted in Langfuse. The check rejects missing, duplicate, or changed cases and missing scores. It requires every candidate case to pass and specifically reports cases that passed in production but fail in the candidate. Both experiment runs and their accuracy scores are recorded in Langfuse with the prompt version and Git SHA in metadata. The GitHub workflow runs typechecking and local tests before making model calls.

For a larger production evaluation, curate and version the dataset and baseline through review. Langfuse documents [prompt versions and labels](https://langfuse.com/docs/prompt-management/features/prompt-version-control), [SDK experiments](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk), and [CI regression gates](https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd).
