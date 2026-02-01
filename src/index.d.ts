import { Request, Response } from 'express';
import { DurableContext } from './context';
export { DurableContext };
export type DurableWorkflow = (event: any, ctx: DurableContext) => Promise<any>;
export declare function withDurableExecution(workflow: DurableWorkflow): (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=index.d.ts.map