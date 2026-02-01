"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DurableContext = exports.DurableSleepInterrupt = void 0;
const tasks_1 = require("@google-cloud/tasks");
const metadata = __importStar(require("gcp-metadata"));
class DurableSleepInterrupt extends Error {
    constructor() {
        super('DurableSleepInterrupt');
        this.name = 'DurableSleepInterrupt';
    }
}
exports.DurableSleepInterrupt = DurableSleepInterrupt;
class DurableContext {
    constructor(state, event, serviceUrl) {
        this.history = {};
        this.isResuming = false;
        this.sleepCounter = 0;
        this.stepCounter = 0;
        this.seenSteps = new Set();
        if (state) {
            this.history = state.history || {};
            this.isResuming = state.isResuming || false;
        }
        this.originalEvent = event;
        this.serviceUrl = serviceUrl;
        this.tasksClient = new tasks_1.CloudTasksClient();
    }
    async step(name, action) {
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
    async sleep(seconds) {
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
    async scheduleResume(seconds) {
        const project = process.env.GOOGLE_CLOUD_PROJECT;
        let location = process.env.FUNCTION_REGION;
        if (!location) {
            try {
                const region = await metadata.instance('region');
                if (typeof region === 'string') {
                    location = region.split('/').pop();
                }
            }
            catch (e) {
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
        let saEmail = process.env.SERVICE_ACCOUNT_EMAIL;
        if (!saEmail) {
            try {
                saEmail = await metadata.instance('service-accounts/default/email');
            }
            catch (e) {
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
        }
        catch (err) {
            console.error('Failed to create Cloud Task:', err);
            throw err;
        }
    }
}
exports.DurableContext = DurableContext;
//# sourceMappingURL=context.js.map