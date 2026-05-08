import { type RealtimeVoiceServerConfig, type RealtimeVoiceServerController, type RealtimeVoiceToolMap } from "./types.js";
export declare function createRealtimeVoiceServer<const TTools extends RealtimeVoiceToolMap>(config: RealtimeVoiceServerConfig<TTools>): RealtimeVoiceServerController<TTools>;
