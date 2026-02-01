"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DurableContext = exports.DurableSleepInterrupt = void 0;
const tasks_1 = require("@google-cloud/tasks");
class DurableSleepInterrupt extends Error {
    constructor() {
        super('DurableSleepInterrupt');
        this.name = 'DurableSleepInterrupt';
    }
}
exports.DurableSleepInterrupt = DurableSleepInterrupt;
class DurableContext {
    history = {};
    isResuming = false;
    tasksClient;
    originalEvent;
    constructor(state, event) {
        if (state) {
            this.history = state.history || {};
            this.isResuming = state.isResuming || false;
        }
        this.originalEvent = event;
        this.tasksClient = new tasks_1.CloudTasksClient();
    }
    async step(name, action) {
        if (name in this.history) {
            return this.history[name];
        }
        const result = await action();
        this.history[name] = result;
        return result;
    }
    async sleep(seconds) {
        if (seconds < 30) {
            return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        }
        // Long sleep: schedule a task and interrupt
        await this.scheduleResume(seconds);
        throw new DurableSleepInterrupt();
    }
    async scheduleResume(seconds) {
        const project = process.env.GOOGLE_CLOUD_PROJECT;
        const location = process.env.FUNCTION_REGION || 'us-central1';
        const queue = process.env.DURABLE_EXECUTION_QUEUE || 'durable-execution';
        const url = process.env.K_SERVICE_URL;
        if (!url) {
            throw new Error('K_SERVICE_URL environment variable is not set. Cannot schedule resume.');
        }
        const parent = this.tasksClient.queuePath(project, location, queue);
        const payload = {
            durableContext: {
                history: this.history,
                isResuming: true,
            },
            originalEvent: this.originalEvent,
        };
        const task = {
            httpRequest: {
                httpMethod: 'POST',
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
        }
        else {
            // If we don't have an email, we still usually need an oidcToken to call a protected Cloud Run service.
            // We can try to provide an empty object or just the audience if we can determine it.
            // For now, let's assume if it's not provided, the user might be using a public service or handles auth differently.
            // But idiomatic Cloud Run to Cloud Run usually needs the token.
            task.httpRequest.oidcToken = {
                serviceAccountEmail: '', // Using default service account
            };
        }
        await this.tasksClient.createTask({ parent, task });
    }
}
exports.DurableContext = DurableContext;
//# sourceMappingURL=context.js.map