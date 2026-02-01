import { CloudTasksClient } from '@google-cloud/tasks';
import * as metadata from 'gcp-metadata';

export class DurableSleepInterrupt extends Error {
  constructor() {
    super('DurableSleepInterrupt');
    this.name = 'DurableSleepInterrupt';
  }
}

export interface DurableState {
  history: Record<string, any>;
  isResuming: boolean;
}

export class DurableContext {
  public history: Record<string, any> = {};
  public isResuming: boolean = false;
  private tasksClient: CloudTasksClient;
  private originalEvent: any;
  private sleepCounter: number = 0;
  private stepCounter: number = 0;
  private serviceUrl?: string;
  private seenSteps: Set<string> = new Set();

  constructor(state?: DurableState, event?: any, serviceUrl?: string) {
    if (state) {
      this.history = state.history || {};
      this.isResuming = state.isResuming || false;
    }
    this.originalEvent = event;
    this.serviceUrl = serviceUrl;
    this.tasksClient = new CloudTasksClient();
  }

  async step<T>(name: string, action: () => Promise<T>): Promise<T> {
    const id = `step-${name}`;
    
    if (this.seenSteps.has(id)) {
      throw new Error(`Duplicate step name detected: "${name}". Each step within a workflow must have a unique name.`);
    }
    this.seenSteps.add(id);

    if (id in this.history) {
      return this.history[id];
    }

    const result = await action();
    this.history[id] = result;
    return result;
  }

  async sleep(seconds: number): Promise<void> {
    const id = `sleep-${this.sleepCounter++}`;
    if (id in this.history) {
      return;
    }

    if (seconds < 30) {
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      this.history[id] = true;
      return;
    }

    // Long sleep: schedule a task and interrupt
    this.history[id] = true;
    console.log(`Suspending execution for ${seconds}s...`);
    await this.scheduleResume(seconds);
    throw new DurableSleepInterrupt();
  }

  private async scheduleResume(seconds: number) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    let location = process.env.FUNCTION_REGION;
    
    if (!location) {
      try {
        const region = await metadata.instance('region');
        if (typeof region === 'string') {
          location = region.split('/').pop();
        }
      } catch (e) {
        location = 'us-central1';
      }
    }

    const queue = process.env.DURABLE_EXECUTION_QUEUE || 'default';
    const url = process.env.K_SERVICE_URL || this.serviceUrl;

    if (!url) {
      throw new Error('Service URL could not be determined. Please set K_SERVICE_URL environment variable.');
    }

    if (!project) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is not set.');
    }

    const parent = this.tasksClient.queuePath(project, location || 'us-central1', queue);
    
    const payload = {
      durableContext: {
        history: this.history,
        isResuming: true,
      },
      originalEvent: this.originalEvent,
    };

    const task: any = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url,
        body: Buffer.from(JSON.stringify(payload)),
        headers: {
          'Content-Type': 'application/json',
        },
      },
      scheduleTime: {
        seconds: Math.floor(Date.now() / 1000) + seconds,
      },
    };

    let saEmail = process.env.SERVICE_ACCOUNT_EMAIL;
    if (!saEmail) {
      try {
        saEmail = await metadata.instance('service-accounts/default/email');
      } catch (e) {
        console.warn('Could not auto-detect service account email from metadata server.');
      }
    }

    if (saEmail) {
      task.httpRequest.oidcToken = {
        serviceAccountEmail: saEmail,
      };
    }

    try {
      const [response] = await this.tasksClient.createTask({ parent, task });
      console.log(`Task created: ${response.name}`);
    } catch (err) {
      console.error('Failed to create Cloud Task:', err);
      throw err;
    }
  }
}
