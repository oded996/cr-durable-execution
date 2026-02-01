import { Request, Response } from 'express';
import { DurableContext, DurableSleepInterrupt, DurableState } from './context';

export { DurableContext, DurableSleepInterrupt, DurableState };
export type DurableWorkflow = (event: any, ctx: DurableContext) => Promise<any>;

export function withDurableExecution(workflow: DurableWorkflow) {
  return async (req: Request, res: Response) => {
    let state: DurableState | undefined;

    // Try to extract state from the request body
    if (req.body && req.body.durableContext) {
      state = req.body.durableContext;
    }

    const event = req.body?.originalEvent || req.body;
    
    // Detect service URL from headers if not provided via env
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];
    const serviceUrl = host ? `${protocol}://${host}` : undefined;

    const ctx = new DurableContext(state, event, serviceUrl);

    try {
      const result = await workflow(event, ctx);
      res.status(200).json({
        status: 'completed',
        result,
      });
    } catch (error) {
      if (error instanceof DurableSleepInterrupt) {
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
