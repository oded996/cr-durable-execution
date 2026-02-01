# Design Document: Cloud Run Durable Execution JS SDK

## 1. Overview
The library enables long-running, resilient workflows on Cloud Run by using a "rehydration" pattern. Instead of persisting state in a central database, the execution state is passed back and forth between the application and a scheduler (Cloud Tasks). This allows functions to "sleep" for long periods without paying for compute, and resume exactly where they left off.

## 2. Core Components

### 2.1 `withDurableExecution(workflowFn)`
A higher-order function that wraps a standard Cloud Run/Function handler.
- **Responsibility**: 
    - Parses the incoming request to detect if it's an initial execution or a "resume" call.
    - Initializes the `DurableContext` with any existing state found in the payload.
    - Catches "Interrupt" signals (e.g., when a long sleep is triggered) to terminate the current execution gracefully and return a success status to the caller.

### 2.2 `DurableContext` (The `ctx` object)
The stateful context passed as the second argument to the workflow function.

#### `ctx.step(name, action)`
- **`name`**: A unique identifier for the step within the workflow.
- **Behavior**:
    1. Checks `ctx.history` (rehydrated from the request) for a result associated with `name`.
    2. If found: Returns the persisted result immediately (skips execution).
    3. If not found: Executes the `action` (async function), stores the result in `ctx.history`, and returns it.

#### `ctx.sleep(seconds)`
- **Behavior**:
    1. **Short Sleep (< 30s)**: Uses standard `setTimeout`/`Promise` to pause execution within the same request.
    2. **Long Sleep (>= 30s)**:
        - Captures current `ctx.history`.
        - Calls the Google Cloud Tasks API to create a task scheduled at `now + seconds`.
        - The task payload contains the `history`, the original `event` data, and a flag indicating it is a resume call.
        - Throws a `DurableSleepInterrupt` (an internal error) to stop the current execution.

## 3. State & Execution Flow

### State Schema
The "State" is a JSON object passed in the request body (or a specific header). It contains the results of all steps completed so far.
```json
{
  "durableContext": {
    "history": {
      "fetch-profile": { "id": "123", "email": "user@example.com" },
      "send-email": "success"
    },
    "isResuming": true
  },
  "originalEvent": { ... }
}
```

### Execution Lifecycle
1. **Initial Trigger**: User or event calls the Cloud Run service. `ctx.history` is empty.
2. **Step Execution**: `ctx.step` runs logic and adds results to `history`.
3. **Long Wait**: `ctx.sleep(86400)` (24 hours) is called. 
    - The SDK schedules a Cloud Task with the current `history`.
    - The current Cloud Run request finishes with a `202 Accepted`.
4. **Resumption**: After 24 hours, Cloud Tasks POSTs back to the Cloud Run service with the accumulated `history`.
5. **Replay**: `withDurableExecution` runs the `workflowFn` again. `ctx.step` calls see their results in `history` and return them instantly, "fast-forwarding" the code to the point where the sleep occurred.

## 4. Technical Requirements & Dependencies

- **Cloud Tasks**: Used as the external timer/scheduler.
- **Authentication**: The library must handle OIDC token generation for Cloud Tasks so the POST-back to Cloud Run is authorized.
- **Service Discovery**: The library needs its own URL to tell Cloud Tasks where to POST. This will be pulled from environment variables (`K_SERVICE_URL`) or request headers.
- **No Side Effects**: Developers must be warned that code outside of `ctx.step` will be re-run on every resumption.

## 5. Constraints & Limits
- **Payload Size**: Cloud Tasks has a 100KB limit. Large step results may cause failures.
- **Determinism**: The workflow function must be deterministic. Changing the order or names of steps between executions will cause state mismatches.
