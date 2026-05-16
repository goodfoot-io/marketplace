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
}: {
  item: RenderItem;
  speakingItemId: string | null;
}): React.JSX.Element {
  const speaking = item.role === "user" && item.id === speakingItemId;
  const className = [
    "transcript-item",
    `role-${item.role}`,
    `source-${item.source}`,
    item.streaming ? "streaming" : "",
    speaking ? "speaking" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <article className={className}>{item.text || (item.role === "user" ? "…" : "")}</article>;
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
  const { conversation, streamDrafts, speakingItemId } = useStore(
    useShallow((s) => ({
      conversation: s.conversation.conversation,
      streamDrafts: s.conversation.streamDrafts,
      speakingItemId: s.voice.speakingItemId,
    })),
  );

  if (conversation === null) {
    return (
      <div className="empty-state">
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2v20M5 8v8M19 8v8" />
        </svg>
        <div>Ready to start</div>
      </div>
    );
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
  for (const draft of streamDrafts.values()) {
    if (byTranscript.has(draft.itemId)) {
      continue;
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

  return <>{nodes}</>;
}
