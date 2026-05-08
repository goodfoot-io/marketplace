import type { EventMap, TypedEventEmitter, Unsubscribe } from "./types.js";
export declare class StrictEventEmitter<TEvents extends EventMap> implements TypedEventEmitter<TEvents> {
    #private;
    on<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): Unsubscribe;
    once<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): Unsubscribe;
    off<K extends keyof TEvents>(eventName: K, handler: (event: TEvents[K]) => void): void;
    protected emit<K extends keyof TEvents>(eventName: K, event: TEvents[K]): void;
}
