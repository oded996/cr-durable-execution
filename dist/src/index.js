"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DurableSleepInterrupt = exports.DurableContext = void 0;
exports.withDurableExecution = withDurableExecution;
const context_1 = require("./context");
Object.defineProperty(exports, "DurableContext", { enumerable: true, get: function () { return context_1.DurableContext; } });
Object.defineProperty(exports, "DurableSleepInterrupt", { enumerable: true, get: function () { return context_1.DurableSleepInterrupt; } });
function withDurableExecution(workflow) {
    return async (req, res) => {
        let state;
        // Try to extract state from the request body
        if (req.body && req.body.durableContext) {
            state = req.body.durableContext;
        }
        const event = req.body?.originalEvent || req.body;
        // Detect service URL from headers if not provided via env
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['host'];
        const serviceUrl = host ? `${protocol}://${host}` : undefined;
        const ctx = new context_1.DurableContext(state, event, serviceUrl);
        try {
            const result = await workflow(event, ctx);
            res.status(200).json({
                status: 'completed',
                result,
            });
        }
        catch (error) {
            if (error instanceof context_1.DurableSleepInterrupt) {
                // This is a graceful interruption for a long sleep
                res.status(202).json({
                    status: 'suspended',
                });
                return;
            }
            console.error('Workflow failed:', error);
            res.status(500).json({
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
//# sourceMappingURL=index.js.map