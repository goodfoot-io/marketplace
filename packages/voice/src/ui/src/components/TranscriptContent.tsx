import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type {
  ConversationSnapshot,
  ToolCallRecord,
  TranscriptItem as TranscriptItemType,
  VoiceAgentToolMap,
} from "../../../types.js";
import { useStore } from "../store/index.js";

type ToolCall = ToolCallRecord<VoiceAgentToolMap>;

interface RenderItem {
  id: string;
  role: string;
  source: string;
  text: string;
  streaming: boolean;
}

function TranscriptItemView({
  item,
  speakingItemId,
  forceSpeaking = false,
}: {
  item: RenderItem;
  speakingItemId: string | null;
  // The synthetic placeholder forces the `speaking` class for its whole life
  // so the pulsing-dot indicator stays visible until real text replaces it
  // (the dot is the placeholder — there is no ellipsis text).
  forceSpeaking?: boolean;
}): React.JSX.Element {
  const speaking = forceSpeaking || (item.role === "user" && item.id === speakingItemId);
  const className = [
    "transcript-item",
    `role-${item.role}`,
    `source-${item.source}`,
    item.streaming ? "streaming" : "",
    speaking ? "speaking" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <article className={className}>{item.text}</article>;
}

function ToolCallView({ tool }: { tool: ToolCall }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const toggle = (): void => setExpanded((v) => !v);
  const result =
    tool.status === "completed"
      ? tool.result
      : tool.status === "failed" || tool.status === "interrupted"
        ? tool.error
        : null;
  return (
    <article
      className="tool-call"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div className="tool-row">
        <span className="toggle">{expanded ? "▾" : "▸"}</span>
        <span>Tool: {tool.toolName}(...)</span>
        <span className={`badge ${tool.status}`}>{tool.status}</span>
      </div>
      {expanded ? (
        <div className="tool-call-body">
          <div className="section-label">ARGUMENTS</div>
          <pre>{JSON.stringify(tool.arguments, null, 2)}</pre>
          <div className="section-label">RESULT</div>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Ported from renderTranscript()/renderTranscriptItem()/renderToolCall().
 * Pure render off the `conversation` slice; tool-call expand state is
 * purely local useState.
 */
export function TranscriptContent(): React.JSX.Element {
  const { conversation, streamDrafts, speakingItemId, pendingUserItemId, responseActive } = useStore(
    useShallow((s) => ({
      conversation: s.conversation.conversation,
      streamDrafts: s.conversation.streamDrafts,
      speakingItemId: s.voice.speakingItemId,
      pendingUserItemId: s.voice.pendingUserItemId,
      responseActive: s.voice.responseActive,
    })),
  );

  const readyToStart = (
    <div className="empty-state">
      <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2v20M5 8v8M19 8v8" />
      </svg>
      <div>Ready to start</div>
    </div>
  );

  if (conversation === null) {
    return readyToStart;
  }
  if (conversation.status === "ended") {
    return (
      <div className="ended-state">
        <strong>Conversation ended</strong>
        <span>Transcript is no longer active.</span>
      </div>
    );
  }

  const snapshot: ConversationSnapshot = conversation;
  const byTranscript = new Map<string, TranscriptItemType>(
    snapshot.transcript.map((item) => [item.id, item]),
  );
  const byTool = new Map<string, ToolCall>(snapshot.toolCalls.map((t) => [t.id, t]));

  const nodes: React.JSX.Element[] = [];
  for (const entry of snapshot.timeline) {
    if (entry.type === "transcript") {
      const item = byTranscript.get(entry.transcriptItemId);
      if (item !== undefined) {
        nodes.push(
          <TranscriptItemView
            key={`t-${item.id}`}
            item={{
              id: item.id,
              role: item.role,
              source: item.source,
              text: item.text,
              streaming: false,
            }}
            speakingItemId={speakingItemId}
          />,
        );
      }
    } else {
      const tool = byTool.get(entry.toolCallId);
      if (tool !== undefined) {
        nodes.push(<ToolCallView key={`c-${tool.id}`} tool={tool} />);
      }
    }
  }
  // Defensive: a stream draft normally never carries the pending USER id
  // (drafts are assistant transcripts), but suppress the synthetic if it does.
  let pendingHasNode = false;
  for (const draft of streamDrafts.values()) {
    if (!byTranscript.has(draft.itemId) && draft.itemId === pendingUserItemId) {
      pendingHasNode = true;
      break;
    }
  }

  // The controller only materializes the user transcript slot AFTER speech is
  // committed (and it arrives already carrying final text), so from
  // speech_started until that slot lands there is nothing real to render.
  // Synthesize a pulsing placeholder keyed to `pendingUserItemId` (which
  // outlives speech_stopped) so the bubble stays continuously visible and is
  // replaced atomically when the real item — same xAI id — appears.
  //
  // It is pushed BEFORE the assistant stream drafts: the user spoke first and
  // the assistant's streaming reply comes after. xAI can emit response.created
  // (and stream the answer) before the user's transcription finalizes, so
  // ordering by arrival would otherwise render the assistant's reply ABOVE the
  // user's own utterance. The placeholder anchors the user turn in its correct
  // chronological slot.
  if (
    pendingUserItemId !== null &&
    !pendingHasNode &&
    !byTranscript.has(pendingUserItemId)
  ) {
    nodes.push(
      <TranscriptItemView
        key={`pending-${pendingUserItemId}`}
        item={{
          id: pendingUserItemId,
          role: "user",
          source: "microphone",
          text: "",
          streaming: false,
        }}
        speakingItemId={speakingItemId}
        forceSpeaking
      />,
    );
  }

  let assistantHasNode = false;
  for (const draft of streamDrafts.values()) {
    if (byTranscript.has(draft.itemId)) {
      continue;
    }
    if (draft.role === "assistant") {
      assistantHasNode = true;
    }
    nodes.push(
      <TranscriptItemView
        key={`d-${draft.itemId}`}
        item={{
          id: draft.itemId,
          role: draft.role,
          source: draft.source,
          text: draft.fullTextSoFar,
          streaming: true,
        }}
        speakingItemId={speakingItemId}
      />,
    );
  }

  // Assistant counterpart to the user speaking placeholder: while the model
  // is generating its reply (responseActive) but has not yet emitted any
  // transcript text, show a green assistant-style placeholder bubble in the
  // assistant's chronological slot (last). The moment the assistant's
  // streaming transcript draft appears it takes over, exactly as the user
  // placeholder hands off to the real user item.
  if (responseActive && !assistantHasNode) {
    nodes.push(
      <TranscriptItemView
        key="pending-assistant"
        item={{
          id: "pending-assistant",
          role: "assistant",
          source: "assistantAudio",
          text: "",
          streaming: false,
        }}
        speakingItemId={speakingItemId}
        forceSpeaking
      />,
    );
  }

  // An active conversation that has not produced any transcript items, tool
  // calls, or live placeholders yet still reads as "no conversation" to the
  // user — show the same Ready-to-start graphic rather than a blank panel.
  if (nodes.length === 0) {
    return readyToStart;
  }

  return <>{nodes}</>;
}
