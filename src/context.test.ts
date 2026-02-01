import { DurableContext, DurableSleepInterrupt } from './context';
import { CloudTasksClient } from '@google-cloud/tasks';

const mockCreateTask = jest.fn().mockResolvedValue([{}]);
const mockQueuePath = jest.fn().mockReturnValue('path/to/queue');

jest.mock('@google-cloud/tasks', () => {
  return {
    CloudTasksClient: jest.fn().mockImplementation(() => {
      return {
        createTask: mockCreateTask,
        queuePath: mockQueuePath,
      };
    }),
  };
});

describe('DurableContext', () => {
  let ctx: DurableContext;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = new DurableContext();
  });

  test('step executes action and stores result if not in history', async () => {
    const action = jest.fn().mockResolvedValue('result1');
    const result = await ctx.step('step1', action);

    expect(result).toBe('result1');
    expect(action).toHaveBeenCalledTimes(1);
    expect(ctx.history['step1']).toBe('result1');
  });

  test('step skips execution and returns result from history', async () => {
    ctx.history['step1'] = 'persisted-result';
    const action = jest.fn();
    const result = await ctx.step('step1', action);

    expect(result).toBe('persisted-result');
    expect(action).not.toHaveBeenCalled();
  });

  test('short sleep (< 30s) uses setTimeout', async () => {
    const start = Date.now();
    await ctx.sleep(0.1); // 100ms
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(100);
  });

  test('long sleep (>= 30s) schedules task and throws interrupt', async () => {
    process.env.K_SERVICE_URL = 'https://my-service.com';
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';
    const event = { userId: '123' };
    ctx = new DurableContext(undefined, event);

    await expect(ctx.sleep(60)).rejects.toThrow(DurableSleepInterrupt);
    expect(mockCreateTask).toHaveBeenCalled();
    
    const taskCall = mockCreateTask.mock.calls[0][0].task;
    const body = JSON.parse(Buffer.from(taskCall.httpRequest.body, 'base64').toString());
    expect(body.durableContext.isResuming).toBe(true);
    expect(body.originalEvent).toEqual(event);
  });
});
