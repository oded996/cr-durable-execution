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
    private sleepCounter;
    private stepCounter;
    private serviceUrl?;
    constructor(state?: DurableState, event?: any, serviceUrl?: string);
    step<T>(name: string, action: () => Promise<T>): Promise<T>;
    sleep(seconds: number): Promise<void>;
    private scheduleResume;
}
