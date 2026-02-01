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
    sleepCount = 0;
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
        const sleepId = `__sleep_${this.sleepCount++}`;
        if (sleepId in this.history) {
            return;
        }
        if (seconds < 30) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.history[sleepId] = true;
                    resolve();
                }, seconds * 1000);
            });
        }
        // Long sleep: schedule a task and interrupt
        this.history[sleepId] = true;
        await this.scheduleResume(seconds);
        throw new DurableSleepInterrupt();
    }
    async scheduleResume(seconds) {
        const project = process.env.GOOGLE_CLOUD_PROJECT;
        const location = process.env.FUNCTION_REGION || 'us-central1';
        const queue = process.env.DURABLE_EXECUTION_QUEUE || 'default';
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
                body: Buffer.from(JSON.stringify(payload)),
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
        await this.tasksClient.createTask({ parent, task });
    }
}
exports.DurableContext = DurableContext;
//# sourceMappingURL=context.js.map