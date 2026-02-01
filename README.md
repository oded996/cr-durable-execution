# Cloud Run Durable Execution JS SDK

A lightweight JavaScript library that brings durable execution capabilities to Google Cloud Run. It allows your functions to run for days or weeks, handle idle waiting (sleep) without paying for compute, and remain resilient to restarts.

## Features

- **`ctx.step(name, action)`**: Ensures a block of code runs exactly once. Results are persisted and skipped during re-executions.
- **`ctx.sleep(seconds)`**: Pauses execution. For waits longer than 30 seconds, it automatically offloads to Cloud Tasks to save on compute costs and resumes exactly where it left off.
- **Zero Database Setup**: State is managed via a rehydration pattern using Cloud Tasks payloads, requiring no external database for many use cases.
- **Code-First**: Define your workflows in pure JavaScript/TypeScript without complex YAML or DSLs.

## Installation

```bash
npm install https://github.com/oded996/cr-durable-execution
```

## How it Works

The library uses a **rehydration** pattern. When `ctx.sleep()` is called for a long duration:
1. The current execution state (history of completed steps) is captured.
2. A Cloud Task is scheduled to POST back to the same function after the sleep duration.
3. The current request terminates gracefully.
4. When the Cloud Task triggers, the function runs again, "fast-forwarding" through already completed steps using the saved history.

## Usage Example

### 1. Define your Workflow

```typescript
import { withDurableExecution, DurableContext } from 'cr-durable-execution';

const workflow = async (event: any, ctx: DurableContext) => {
  const { userId } = event;

  // 1. This step runs once and its result is saved
  const profile = await ctx.step("fetch-profile", async () => {
    return await fetchProfile(userId);
  });

  // 2. The function stops here and resumes in 24 hours
  // You don't pay for the 24 hours of idle time!
  await ctx.sleep(86400); 

  // 3. Execution resumes here with 'profile' restored
  await ctx.step("send-follow-up", async () => {
    await sendEmail(profile.email, "Welcome back!");
  });

  return { success: true };
};

export const myDurableFunction = withDurableExecution(workflow);
```

### 2. Deploy to Cloud Run

Deploy using the standard `gcloud` command. 

> **Note on Service URL**: The library attempts to automatically detect your service URL from incoming requests. If this fails, or for your very first execution, you may need to set `K_SERVICE_URL`.

```bash
gcloud run deploy my-service \
  --source . \
  --function myDurableFunction \
  --set-env-vars GOOGLE_CLOUD_PROJECT=[PROJECT_ID],FUNCTION_REGION=[REGION]
```

## Configuration

### Mandatory Environment Variables
- `GOOGLE_CLOUD_PROJECT`: Your GCP Project ID. Required for Cloud Tasks integration.

### Optional Environment Variables
- `K_SERVICE_URL`: Manual override for the public URL of your Cloud Run service. Automatically detected from request headers if not set.
- `FUNCTION_REGION`: The region where your service is deployed (e.g., `us-central1`). Defaults to `us-central1`.
- `SERVICE_ACCOUNT_EMAIL`: The service account used to sign OIDC tokens for resumption calls. **Automatically detected** on Cloud Run if not provided.
- `DURABLE_EXECUTION_QUEUE`: The Cloud Tasks queue to use. Defaults to `default`. 

## Requirements

- **Cloud Tasks**: The "default" queue must exist in your project, or you must specify a custom one.
- **IAM Permissions**: The Cloud Run service account needs `cloudtasks.tasks.create` and `iam.serviceAccounts.actAs` permissions.

## License

ISC
