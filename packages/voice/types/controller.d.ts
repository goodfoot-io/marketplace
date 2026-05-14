import { type VoiceAgentServerConfig, type VoiceAgentServerController, type VoiceAgentToolMap } from "./types.js";
export declare function createVoiceAgentServer<const TTools extends VoiceAgentToolMap>(config: VoiceAgentServerConfig<TTools>): VoiceAgentServerController<TTools>;
