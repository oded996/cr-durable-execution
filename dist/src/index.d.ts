import { Request, Response } from 'express';
import { DurableContext, DurableSleepInterrupt, DurableState } from './context';
export { DurableContext, DurableSleepInterrupt, DurableState };
export type DurableWorkflow = (event: any, ctx: DurableContext) => Promise<any>;
export declare function withDurableExecution(workflow: DurableWorkflow): (req: Request, res: Response) => Promise<void>;
