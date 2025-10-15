# Autobio Package Architecture Report

## Executive Summary
The autobio package is a sophisticated real-time voice-enabled productivity assistant that combines WebRTC-based voice interaction, multi-agent task delegation, and graph-based data management. It uses a three-layer communication architecture to coordinate between OpenAI's Realtime API, Socket.IO messaging, and PostgreSQL persistence.

## Core Architecture

### Component Map

#### **Application Layer** 
- **`src/app/page.tsx:1-34`** - Server component entry point
  - Creates realtime sessions server-side
  - Fetches initial graph data
  - Passes hydration data to client
  
- **`src/app/App.tsx:1-437`** - Main client orchestrator
  - Manages WebRTC and Socket.IO connections
  - Coordinates state across all stores
  - Handles push-to-talk and audio controls
  - Routes events between communication layers

#### **State Management (Zustand)**
- **`appStore.ts:1-269`** - Central application state
  - Transcript items with immer for immutability
  - Event logging (client/server events)
  - Session and authentication state
  
- **`realtimeStore.ts:1-400+`** - Voice communication state
  - WebRTC connection lifecycle (`connectionStatus`)
  - Audio element DOM management
  - Push-to-talk state machine
  - Agent configuration with persist middleware

- **`socketStore.ts`** - WebSocket state
  - Socket.IO connection management
  - Message routing to server
  - Room-based agent coordination

- **`graphStore.ts`** - Productivity data state
  - Lists, notes, tasks, questions, reminders
  - Real-time synchronization subscriptions

### Data Flow Patterns

#### **Three-Layer Communication Architecture**

```
┌─────────────┐     WebRTC      ┌──────────────┐
│   Browser   │ ◄──────────────► │ OpenAI API   │
│   Client    │                  │  (Realtime)  │
└──────┬──────┘                  └──────────────┘
       │
       │ Socket.IO
       ▼
┌─────────────┐     PostgreSQL   ┌──────────────┐
│   Server    │ ◄──────────────► │   Database   │
│  (Node.js)  │                  │              │
└─────────────┘                  └──────────────┘
```

**Layer 1: WebRTC Voice Channel** (`src/app/lib/realtimeClient.ts:1-250`)
- Direct peer-to-peer audio streaming
- Echo cancellation and noise suppression
- Ephemeral key authentication
- getUserMedia constraints: `src/app/lib/realtimeClient.ts:79-85`

**Layer 2: Socket.IO Data Channel** (`src/server/lib/socketServer.ts:46-300+`)
- Event broadcasting to all connected clients
- Agent coordination messages
- Transcript persistence
- Rate limiting: 10 messages/5 seconds (`messageCoordinator.ts:23-25`)

**Layer 3: Database Persistence** (`src/server/lib/sql.ts`)
- Conversation history storage
- Graph data persistence (tasks, notes, lists)
- User workspace management

### Integration Mechanisms

#### **Voice Interaction Flow**
```typescript
// src/app/App.tsx:319-327 - Push-to-talk state machine
User Press → handleTalkButtonDown() → pushToTalkStart() 
         → RealtimeClient.startUserAudio() → WebRTC Stream

User Release → handleTalkButtonUp() → pushToTalkStop()
           → RealtimeClient.stopUserAudio() → End Stream
```

#### **Message Routing Pattern**
```typescript
// src/server/lib/messageCoordinator.ts:86-180
incomingMessage → validateMessage() → checkRateLimit()
              → sanitizeMessage() → conversationHistory.push()
              → socket.broadcast('message', sanitized)
```

#### **Graph Update Synchronization**
```typescript
// Real-time graph updates via Socket.IO
Server DB Change → io.emit('graphUpdate', delta)
               → Client graphStore.applyUpdate(delta)
               → React Component Re-render
```

## Technical Implementation

### Design Patterns

#### **Command Pattern** - Tool System
```typescript
// src/server/agents/tools/productivity-tools.ts:46-72
tool({
  name: "createList",
  parameters: zodSchema,
  execute: async (params) => {
    const startTime = Date.now();
    logToolCall(name, params, startTime);
    return handlers.createList(params);
  }
})
```
- Encapsulates tool operations as commands
- Provides consistent logging and error handling
- Enables tool composition and delegation

#### **Middleware Pattern** - Authentication
```typescript
// src/server/lib/socketServer.ts:60-81
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const { valid, userId } = await isValidToken(token);
  if (valid) {
    socket.data.userId = userId;
    next();
  } else {
    next(new Error('Authentication failed'));
  }
})
```

#### **Observer Pattern** - Store Subscriptions
```typescript
// src/app/stores/realtimeStore.ts:47-48
create<RealtimeState>()(
  subscribeWithSelector(    // Enable selective subscriptions
    persist(                // LocalStorage persistence
      immer((set, get) =>   // Immutable state updates
```

### Performance Characteristics

#### **Audio Optimization**
- **WebRTC Constraints** (`realtimeClient.ts:79-85`)
  - Echo cancellation enabled
  - Noise suppression active
  - Auto gain control
  - Sample rate: 24000 Hz for optimal quality

#### **Rate Limiting** (`messageCoordinator.ts:22-44`)
- In-memory rate limit tracking
- 10 messages per 5-second window
- Periodic cleanup of stale records (60s interval)
- Per-socket tracking for fairness

#### **State Management Optimization**
- **Immer middleware** for structural sharing
- **Selective subscriptions** to prevent unnecessary re-renders
- **LocalStorage persistence** for settings continuity

### State Management

#### **Session Lifecycle**
```typescript
// src/app/stores/realtimeStore.ts:67-82
initialize(sessionData) → checkExistingSession()
                       → disconnectIfNeeded()
                       → createAudioElement()
                       → createAgent(instructions)
                       → setConnectionStatus('READY')
```

#### **Transcript Management**
- Unified transcript with message types (user, assistant, breadcrumb)
- Immutable updates via immer
- Server-side persistence for history
- Real-time synchronization across clients

## Architectural Insights

### Design Decisions

#### **Hybrid Communication Model**
The architecture deliberately separates voice (WebRTC) from data (Socket.IO) to:
- Enable independent scaling of voice and data channels
- Allow voice to work even if data connection fails
- Reduce latency for voice interactions
- Provide fallback text input when voice unavailable

#### **Multi-Agent Architecture**
```typescript
// Agent Types and Responsibilities
Voice Agent (Alexander) - WebRTC direct user interaction
Analyzer Agent - Server-side conversation analysis
Secondary Agents - Specialized task delegation
```
This separation enables:
- Specialized processing without blocking voice
- Parallel task execution
- Modular capability extension

#### **Contract-Driven Validation**
All data exchanges use Zod schemas with validation decorators:
- Type safety at runtime boundaries
- Automatic input/output validation
- Clear API contracts between components

### Constraints and Limitations

#### **Browser Requirements**
- WebRTC support required (modern browsers only)
- Microphone permissions mandatory for voice
- LocalStorage for settings persistence

#### **Scalability Constraints**
- In-memory rate limiting (not distributed)
- Single PostgreSQL instance (no sharding)
- WebRTC peer connections (not media server)

#### **Security Boundaries**
- Ephemeral keys for OpenAI API (expire after session)
- Token-based Socket.IO authentication
- Sanitization of all user inputs before broadcast

### Extension Points

#### **Tool System Extensibility**
The command pattern tool system (`productivity-tools.ts`) allows:
- New tools via simple function registration
- Consistent logging and error handling
- Tool composition for complex operations

#### **Agent Extensibility**
New agents can be added by:
- Implementing agent interface
- Registering with MessageCoordinator
- Joining appropriate Socket.IO rooms

#### **Store Middleware**
Additional middleware can enhance stores:
- Analytics tracking
- Undo/redo functionality
- Remote debugging capabilities

## File Reference Map

### Core Application Files
- `src/app/App.tsx` - Main client orchestrator
- `src/app/page.tsx` - Server component entry
- `src/app/layout.tsx` - Root layout

### State Management
- `src/app/stores/appStore.ts` - Application state
- `src/app/stores/realtimeStore.ts` - Voice/WebRTC state
- `src/app/stores/socketStore.ts` - Socket.IO state
- `src/app/stores/graphStore.ts` - Graph data state
- `src/app/stores/uiStore.ts` - UI preferences

### Communication Layer
- `src/app/lib/realtimeClient.ts` - WebRTC wrapper
- `src/server/lib/socketServer.ts` - Socket.IO server
- `src/server/lib/messageCoordinator.ts` - Message routing

### Agent System
- `src/server/agents/tools/productivity-tools.ts` - Tool definitions
- `src/server/agents/analyzer/` - Analyzer agent
- `src/app/agents/voice/` - Voice agent configuration

### Data Layer
- `src/server/lib/sql.ts` - Database connections
- `src/shared/contracts/` - Validation schemas

This architecture enables a sophisticated real-time productivity assistant with voice-first interaction, multi-agent task delegation, and extensible tool capabilities, while maintaining clear separation of concerns and robust error handling throughout the system.