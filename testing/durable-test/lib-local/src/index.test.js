"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const context_1 = require("./context");
const express_1 = require("express");
describe('withDurableExecution', () => {
    let mockReq;
    let mockRes;
    let statusMock;
    let jsonMock;
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
        const handler = (0, index_1.withDurableExecution)(workflow);
        await handler(mockReq, mockRes);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({ status: 'completed', result: 'done' });
        expect(workflow).toHaveBeenCalled();
    });
    test('returns 202 on DurableSleepInterrupt', async () => {
        const workflow = jest.fn().mockImplementation(async () => {
            throw new context_1.DurableSleepInterrupt();
        });
        const handler = (0, index_1.withDurableExecution)(workflow);
        await handler(mockReq, mockRes);
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
        const workflow = async (event, ctx) => {
            return await ctx.step('step1', async () => 'new-result');
        };
        const handler = (0, index_1.withDurableExecution)(workflow);
        await handler(mockReq, mockRes);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({ status: 'completed', result: 'result1' });
    });
});
//# sourceMappingURL=index.test.js.map