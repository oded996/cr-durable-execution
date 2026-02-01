export declare class DurableSleepInterrupt extends Error {
    constructor();
}
export interface DurableState {
    history: Record<string, any>;
    isResuming: boolean;
}
export declare class DurableContext {
    history: Record<string, any>;
    isResuming: boolean;
    private tasksClient;
    private originalEvent;
    constructor(state?: DurableState, event?: any);
    step<T>(name: string, action: () => Promise<T>): Promise<T>;
    sleep(seconds: number): Promise<void>;
    private scheduleResume;
}
//# sourceMappingURL=context.d.ts.map