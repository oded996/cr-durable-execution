import { withDurableExecution } from './index';
import { DurableContext, DurableSleepInterrupt } from './context';
import { Request, Response } from 'express';

describe('withDurableExecution', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn().mockReturnThis();
    mockReq = {
      body: {},
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  test('executes workflow and returns 200 on success', async () => {
    const workflow = jest.fn().mockResolvedValue('done');
    const handler = withDurableExecution(workflow);

    await handler(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ status: 'completed', result: 'done' });
    expect(workflow).toHaveBeenCalled();
  });

  test('returns 202 on DurableSleepInterrupt', async () => {
    const workflow = jest.fn().mockImplementation(async () => {
      throw new DurableSleepInterrupt();
    });
    const handler = withDurableExecution(workflow);

    await handler(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(202);
    expect(jsonMock).toHaveBeenCalledWith({ status: 'suspended' });
  });

  test('rehydrates state from request body', async () => {
    mockReq.body = {
      durableContext: {
        history: { step1: 'result1' },
        isResuming: true,
      },
    };

    const workflow = async (event: any, ctx: DurableContext) => {
      return await ctx.step('step1', async () => 'new-result');
    };
    const handler = withDurableExecution(workflow);

    await handler(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ status: 'completed', result: 'result1' });
  });
});
