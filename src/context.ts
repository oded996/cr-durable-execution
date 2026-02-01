import { CloudTasksClient } from '@google-cloud/tasks';

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

  constructor(state?: DurableState, event?: any) {
    if (state) {
      this.history = state.history || {};
      this.isResuming = state.isResuming || false;
    }
    this.originalEvent = event;
    this.tasksClient = new CloudTasksClient();
  }

  async step<T>(name: string, action: () => Promise<T>): Promise<T> {
    const id = `step-${name}`;
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
    await this.scheduleResume(seconds);
    throw new DurableSleepInterrupt();
  }

  private async scheduleResume(seconds: number) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.FUNCTION_REGION || 'us-central1';
    const queue = process.env.DURABLE_EXECUTION_QUEUE || 'default';
    const url = process.env.K_SERVICE_URL;

    if (!url) {
      throw new Error('K_SERVICE_URL environment variable is not set. Cannot schedule resume.');
    }

    const parent = this.tasksClient.queuePath(project!, location, queue);
    
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
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        headers: {
          'Content-Type': 'application/json',
        },
      },
      scheduleTime: {
        seconds: Math.floor(Date.now() / 1000) + seconds,
      },
    };

    if (process.env.SERVICE_ACCOUNT_EMAIL) {
      task.httpRequest.oidcToken = {
        serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL,
      };
    } else {
      // If we don't have an email, we still usually need an oidcToken to call a protected Cloud Run service.
      // We can try to provide an empty object or just the audience if we can determine it.
      // For now, let's assume if it's not provided, the user might be using a public service or handles auth differently.
      // But idiomatic Cloud Run to Cloud Run usually needs the token.
      task.httpRequest.oidcToken = {
        serviceAccountEmail: '', // Using default service account
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
