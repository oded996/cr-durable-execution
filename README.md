# Cloud Run Durable Execution JS SDK

A lightweight JavaScript library that brings durable execution capabilities to Google Cloud Run. It allows your functions to run for days or weeks, handle idle waiting (sleep) without paying for compute, and remain resilient to restarts.

## Features

- **`ctx.step(name, action)`**: Ensures a block of code runs exactly once. Results are persisted and skipped during re-executions.
- **`ctx.sleep(seconds)`**: Pauses execution. For waits longer than 30 seconds, it automatically offloads to Cloud Tasks to save on compute costs and resumes exactly where it left off.
- **Zero Database Setup**: State is managed via a rehydration pattern using Cloud Tasks payloads, requiring no external database for many use cases.
- **Code-First**: Define your workflows in pure JavaScript/TypeScript without complex YAML or DSLs.

## Installation

> **Important**: This library must be installed as a production dependency (not a devDependency) for it to be available in your Cloud Run container.

```bash
npm install https://github.com/oded996/cr-durable-execution
```

## How it Works

The library uses a **rehydration** pattern. When `ctx.sleep()` is called for a long duration:
1. The current execution state (history of completed steps) is captured.
2. A Cloud Task is scheduled to POST back to the same function after the sleep duration.
3. The current request terminates gracefully.
4. When the Cloud Task triggers, the function runs again, "fast-forwarding" through already completed steps using the saved history.

## Requirements & Permissions

### 1. Enable APIs
Ensure the Cloud Tasks API is enabled in your project.

### 2. IAM Permissions
The Cloud Run service account needs permission to create tasks and act as itself to sign the resumption tokens. Run these commands (replacing the placeholders):

```bash
# Grant Cloud Tasks Enqueuer
gcloud projects add-iam-policy-binding [PROJECT_ID] \
  --member="serviceAccount:[SERVICE_ACCOUNT_EMAIL]" \
  --role="roles/cloudtasks.enqueuer"

# Grant Service Account User (to allow OIDC token generation)
gcloud iam service-accounts add-iam-policy-binding [SERVICE_ACCOUNT_EMAIL] \
  --member="serviceAccount:[SERVICE_ACCOUNT_EMAIL]" \
  --role="roles/iam.serviceAccountUser"
```

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
  --set-env-vars GOOGLE_CLOUD_PROJECT=[PROJECT_ID]
```

## Configuration

The library is designed to work with **zero configuration** on Cloud Run. It automatically detects the Project ID, Region, Service URL, and Service Account.

### Optional Environment Variables (Overrides)
- `GOOGLE_CLOUD_PROJECT`: Manual override for your GCP Project ID.
- `FUNCTION_REGION`: Manual override for the deployment region.
- `K_SERVICE_URL`: Manual override for the public URL of your service.
- `SERVICE_ACCOUNT_EMAIL`: Manual override for the service account used for resumption.
- `DURABLE_EXECUTION_QUEUE`: The Cloud Tasks queue to use (defaults to `default`). 

## Limitations

- **Payload Size**: Cloud Tasks has a **100KB limit** for the total request body. Since the library stores the results of all completed steps in this payload, workflows with very large step results or an extremely high number of steps may hit this limit.

## License

ISC