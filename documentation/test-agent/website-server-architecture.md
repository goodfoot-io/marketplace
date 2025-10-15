# Website Server Architecture Documentation

## Executive Architecture Summary

### System Purpose
The website server is a modern Node.js application implementing a real-time collaborative platform with authentication, WebSocket communication, and PostgreSQL persistence, built on Express, React Router, and YJS.

### Architectural Style
**Layered Architecture with Real-time Event-Driven Components**
- Traditional HTTP request/response pattern via Express middleware pipeline
- Real-time bidirectional communication through WebSocket/YJS
- Server-side rendering (SSR) with React Router
- Event-driven database synchronization

### Key Components
- **Express Application Layer**: Main HTTP server orchestrator with middleware pipeline (`server.ts:13-68`, `server/app.ts:14-203`)
- **Authentication System**: Cookie-based sessions with anonymous user support (`server/lib/auth.ts:8-45`)
- **WebSocket Server**: YJS-based real-time collaboration engine (`server/api/realtime/yjs-server.ts:19-132`)
- **Data Model Layer**: PostgreSQL-backed models for graph-based data structures (`server/lib/models/`)
- **React Router Integration**: SSR and client-side routing support (`server/app.ts:169-203`)

### Critical Patterns
- **Middleware Pipeline Pattern**: Sequential request processing through authentication, routing, and handling
- **Observer Pattern**: Real-time updates via WebSocket connections and database listeners
- **Repository Pattern**: Abstracted database operations through model handlers
- **Error Boundary Pattern**: Comprehensive error handling at each architectural layer

## Detailed Component Analysis

### Core Components

#### Express Application Layer
**Role and Responsibilities**:
- HTTP server initialization and configuration (`server.ts:13-68`)
- Middleware orchestration and request routing (`server/app.ts:14-203`)
- Static asset serving and caching strategies (`server.ts:58-60`)
- Development/production environment handling (`server.ts:33-68`)

**Key Interfaces and APIs**:
```typescript
// Main application instance (server/app.ts:14)
export const app = express();

// Monitoring endpoint (server.ts:20-31)
app.get('/api/yjs/stats', (_req, res) => {
  res.json({
    ...yjsServer.getStats(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

**Dependencies and Relationships**:
- Integrates with Vite for development hot-reload (`server.ts:35-42`)
- Hosts WebSocket server for real-time features (`server.ts:75-103`)
- Delegates authentication to Better Auth framework (`server/app.ts:105-166`)

**Implementation Patterns**:
- Compression middleware for response optimization (`server.ts:16`)
- Morgan logging in production mode (`server.ts:59`)
- Graceful shutdown handling (`server.ts:107-121`)

#### Authentication System
**Role and Responsibilities**:
- Session management with 7-day expiry (`server/lib/auth.ts:17`)
- Anonymous user creation and tracking (`server/lib/auth.ts:25-39`)
- Cookie-based authentication with 5-minute cache (`server/lib/auth.ts:19-22`)
- Authentication state validation and transformation (`server/lib/auth-helpers.ts:7-85`)

**Key Interfaces and APIs**:
```typescript
// Session data retrieval (auth-helpers.ts:7)
export async function getSessionData(request: Request): Promise<{
  session: { id, userId, token, expiresAt, ... } | null;
  user: { id, email, name, isAnonymous, ... } | null;
}>

// Authentication requirement enforcement (auth-helpers.ts:87)
export async function requireAuthenticatedSession(request: Request)
```

**Dependencies and Relationships**:
- Better Auth framework for core authentication (`server/lib/auth.ts:2`)
- Anonymous plugin for guest user support (`server/lib/auth.ts:25-39`)
- Custom error types for consistent error handling (`server/lib/auth-errors.ts:1-17`)

**Implementation Patterns**:
- Automatic anonymous session creation (`server/app.ts:26-101`)
- Session validation middleware (`server/app.ts:43-94`)
- Authentication error classification (`server/lib/auth-errors.ts:12-17`)

#### WebSocket Server (YJS)
**Role and Responsibilities**:
- WebSocket connection management with 30-second timeout (`yjs-server.ts:17`)
- YJS document synchronization (`yjs-server.ts:69`)
- Custom handler registration and routing (`yjs-server.ts:120-122`)
- Error containment and graceful degradation (`yjs-server.ts:49-51`)

**Key Interfaces and APIs**:
```typescript
// Handler registration (yjs-server.ts:120)
use(pathName: string, handler: (params: YjsHandlerParams) => void | Promise<void>)

// Handler parameters (yjs-server.ts:8-14)
type YjsHandlerParams = {
  doc: Doc;
  params: Partial<Record<string, string | string[]>>;
  ws: WebSocket;
  headers: IncomingHttpHeaders;
  searchParams: URLSearchParams;
}
```

**Dependencies and Relationships**:
- YJS library for CRDT-based synchronization (`@y/websocket-server/utils`)
- Path-to-regexp for route matching (`yjs-server.ts:4`)
- Custom error handler for WebSocket errors (`yjs-server.ts:6`)

**Implementation Patterns**:
- Connection timeout management (`yjs-server.ts:37-47`)
- Workspace-based document isolation (`yjs-server.ts:57-61`)
- Handler chain processing (`yjs-server.ts:76-111`)

### Integration Architecture

#### External System Connections
- **PostgreSQL Database** (`server/lib/sql.ts:5-15`): Primary persistence layer with camelCase transformation
- **OpenAI API** (`.env.example:1`): AI integration capabilities (configuration-based)
- **Better Auth Service** (`server/lib/auth.ts:8-45`): Authentication provider

#### API Boundaries and Contracts
**HTTP Endpoints**:
- `/api/auth/*` - Authentication operations (`server/app.ts:105-166`)
- `/api/yjs/stats` - System monitoring (`server.ts:20-31`)
- `/.well-known/*` - Standard web routes (`server/app.ts:21-23`)

**WebSocket Endpoints**:
- `transcript/:sessionId` - Transcript synchronization (`server.ts:89-93`)
- `graph-sync` - Graph data synchronization (`server.ts:96`)

#### Data Exchange Mechanisms
- **Request/Response**: Standard HTTP with JSON/URL-encoded body parsing (`server/app.ts:17-18`)
- **WebSocket**: Binary YJS update messages for real-time sync
- **Server-Sent Events**: Implicit through YJS observer pattern

#### Communication Patterns
- **Synchronous HTTP**: Traditional request-response for API calls
- **Asynchronous WebSocket**: Bidirectional real-time communication
- **Event-driven Updates**: Database change listeners triggering YJS updates (`graph-sync-handler.ts:312`)

### Data Architecture

#### Core Data Structures and Models
**Graph Model** (`server/lib/models/graph.ts:4-9`):
- Graph data structure management
- Active graph dumping and listening capabilities

**List Model** (`server/lib/models/list.ts:4-14`):
- List CRUD operations
- Workspace-scoped list management

**Task Model** (`server/lib/models/task.ts`):
- Task creation and updates
- Task relationship management

**Edge Model** (`server/lib/models/edge.ts`):
- Graph relationship definitions
- Bidirectional edge management

#### Data Flow Patterns
**Graph Synchronization Flow** (`graph-sync-handler.ts:9-326`):
1. Initial data load from PostgreSQL (`graph-sync-handler.ts:306-308`)
2. YJS document initialization with maps and arrays (`graph-sync-handler.ts:15-33`)
3. Incremental updates via database listeners (`graph-sync-handler.ts:312`)
4. Atomic YJS transactions for consistency (`graph-sync-handler.ts:50`)

**Authentication State Flow** (`server/app.ts:43-94`):
1. Session check via Better Auth API (`server/app.ts:53-55`)
2. Anonymous session creation if needed (`server/app.ts:68-78`)
3. Cookie propagation to client (`server/app.ts:81-90`)

#### Transformation and Processing
**Incremental Update Algorithm** (`graph-sync-handler.ts:52-74`):
```typescript
const updateMapIncrementally = <T>(yjsMap: YMap<T>, newData: T[]) => {
  // Only update changed items based on timestamp
  if (!existing || existing.updatedAt < item.updatedAt) {
    yjsMap.set(item.id, { ...item, workspaceId });
  }
  // Remove deleted items
  for (const id of existingIds) {
    if (!newIds.has(id)) yjsMap.delete(id);
  }
};
```

#### State Management Approaches
- **Session State**: Cookie-based with server-side validation
- **Real-time State**: YJS documents with CRDT synchronization
- **Database State**: PostgreSQL as source of truth
- **Cache State**: 5-minute cookie cache for performance

## Implementation Patterns

### Middleware Architecture

#### Request Processing Pipeline
The server implements a sophisticated middleware chain with clear separation of concerns:

**1. Body Parsing Layer** (`server/app.ts:16-18`)
```typescript
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```
- **Purpose**: Parse incoming request bodies
- **Position**: Must be first for auth POST requests
- **Error Handling**: Express built-in error handling

**2. Well-Known URL Handler** (`server/app.ts:20-23`)
```typescript
app.get('/.well-known/*path', (req, res) => {
  res.status(404).end();
});
```
- **Purpose**: Handle standard web routes (Chrome DevTools, etc.)
- **Position**: Early in chain to avoid unnecessary processing

**3. Anonymous Session Middleware** (`server/app.ts:26-101`)
```typescript
app.use(async (req, res, next) => {
  // Skip for static assets and auth endpoints
  if (req.path.startsWith('/api/auth/') || /* other conditions */) {
    return next();
  }
  
  // Check/create anonymous session
  const sessionData = await auth.api.getSession({ headers });
  if (!sessionData) {
    // Create anonymous session via auth handler
    const response = await auth.handler(anonymousRequest);
    // Apply session cookies
  }
  
  next();
});
```
- **Purpose**: Ensure all users have sessions
- **Pattern**: Conditional processing with path filtering
- **Error Handling**: Try-catch with fallback to continue without session

**4. Authentication API Handler** (`server/app.ts:105-166`)
```typescript
app.all('/api/auth/*path', async (req, res) => {
  try {
    // Convert Express request to Web API Request
    const webRequest = new Request(url, { method, headers, body });
    // Process through Better Auth
    const response = await auth.handler(webRequest);
    // Send response
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```
- **Purpose**: Delegate auth operations to Better Auth
- **Pattern**: Request transformation and delegation
- **Error Handling**: Generic error response for security

**5. React Router Handler** (`server/app.ts:169-203`)
```typescript
app.use(createRequestHandler({
  build: () => import('virtual:react-router/server-build'),
  getLoadContext: async (req) => {
    // Get session data for SSR context
    const session = await getSessionData(webRequest);
    return { session };
  }
}));
```
- **Purpose**: Server-side rendering and client routing
- **Pattern**: Dynamic import with context injection
- **Error Handling**: Delegated to React Router

#### Middleware Composition Pattern
The middleware stack demonstrates several key patterns:

1. **Sequential Processing**: Each middleware executes in order
2. **Conditional Bypass**: Path-based filtering for efficiency
3. **Error Propagation**: Errors bubble up through `next(error)`
4. **Context Enrichment**: Session data added to request context
5. **Response Interception**: Cookies modified before sending

### Error Handling Patterns

#### Layered Error Handling Architecture

**1. Authentication Errors** (`server/lib/auth-errors.ts:1-17`)
```typescript
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const AUTH_ERRORS = {
  SESSION_EXPIRED: new AuthError('SESSION_EXPIRED', 'Your session has expired.', 401),
  INVALID_SESSION: new AuthError('INVALID_SESSION', 'Invalid session token.', 401),
  SESSION_NOT_FOUND: new AuthError('SESSION_NOT_FOUND', 'Session not found.', 404),
  INTERNAL_ERROR: new AuthError('INTERNAL_ERROR', 'An internal error occurred.', 500)
};
```
- **Pattern**: Custom error classes with semantic codes
- **Purpose**: Consistent error reporting across auth operations
- **Usage**: Thrown in auth helpers and caught by middleware

**2. WebSocket Error Handling** (`server/utils/error-handler.ts:3-21`)
```typescript
export const handleWebSocketError = (ws: WebSocket, error: Error): void => {
  console.error('[YJS WebSocket Error]', error.message);
  
  // Send error to client if connection is open
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message,
      code: 'YJS_ERROR'
    }));
  }
  
  // Close connection on critical errors
  if (error.message.includes('Memory') || error.message.includes('Too many')) {
    ws.close(1008, 'Resource limit exceeded');
  }
};
```
- **Pattern**: Error classification with appropriate response
- **Purpose**: Graceful WebSocket error recovery
- **Features**: Client notification and resource protection

**3. Async Error Wrapper** (`server/utils/error-handler.ts:23-39`)
```typescript
export const wrapAsync = <T>(fn: T): T => {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error) => {
          console.error('[YJS Async Error]', error);
          throw error;
        });
      }
      return result;
    } catch (error) {
      console.error('[YJS Sync Error]', error);
      throw error;
    }
  }) as T;
};
```
- **Pattern**: Universal error wrapper for sync/async functions
- **Purpose**: Consistent error logging and propagation
- **Usage**: Wrap handlers to ensure error visibility

**4. Session Error Handling** (`server/lib/auth-helpers.ts:63-69`)
```typescript
try {
  const sessionData = await auth.api.getSession({ headers });
  // Process session
} catch (error) {
  if (error instanceof Error && error.message.includes('expired')) {
    throw AUTH_ERRORS.SESSION_EXPIRED;
  }
  console.error('Session retrieval error:', error);
  throw AUTH_ERRORS.INTERNAL_ERROR;
}
```
- **Pattern**: Error transformation with semantic mapping
- **Purpose**: Convert generic errors to domain-specific errors
- **Benefits**: Better error messages for clients

**5. WebSocket Connection Error Handling** (`yjs-server.ts:112-115`)
```typescript
try {
  // WebSocket upgrade logic
} catch (error) {
  console.error('[YJS] WebSocket upgrade error:', error);
  ws.close(1011, 'Internal server error');
}
```
- **Pattern**: Error containment with connection cleanup
- **Purpose**: Prevent hanging connections on errors
- **WebSocket Codes**: Using standard close codes (1011 for server error)

#### Error Handling Strategies

**1. Fail-Safe Defaults**:
- Anonymous session creation continues on error (`server/app.ts:95-98`)
- Server runs without WebSocket if initialization fails (`server.ts:100-103`)

**2. Error Boundaries**:
- Each architectural layer has its own error handling
- Errors are caught and transformed at layer boundaries
- WebSocket errors isolated from HTTP server

**3. Resource Protection**:
- Memory/connection limit errors trigger immediate disconnection
- Timeout mechanisms prevent resource exhaustion
- Graceful degradation when services unavailable

**4. Error Logging Patterns**:
```typescript
console.error('[Component] Context:', error);
```
- Consistent prefix for log filtering
- Context information for debugging
- Structured error data when available

**5. Client Error Communication**:
- HTTP: Status codes and JSON error responses
- WebSocket: Typed error messages via JSON
- SSR: Error boundaries in React components

### Performance Patterns

#### Optimization Strategies
**Connection Management** (`yjs-server.ts:36-47`):
- 30-second timeout for idle connections
- Ping/pong mechanism for keepalive
- Automatic cleanup on connection close

**Incremental Updates** (`graph-sync-handler.ts:52-74`):
- Timestamp-based change detection
- Batch updates in transactions
- Minimal data transfer via diff algorithms

**Caching Strategies**:
- **Static Assets**: 1-year cache for immutable files (`server.ts:58`)
- **Client Build**: 1-hour cache for build output (`server.ts:60`)
- **Session Cookies**: 5-minute cache for performance (`auth.ts:21`)

**Resource Management**:
- Connection pooling via postgres library
- Memory monitoring endpoint (`server.ts:26`)
- Graceful shutdown handlers (`server.ts:107-121`)

#### Performance-Critical Paths
1. **WebSocket Message Processing**: Direct YJS document updates
2. **Database Synchronization**: Incremental updates only
3. **Session Validation**: Cached cookie validation
4. **Static Asset Serving**: Long-term caching with immutable flag

## Architectural Insights

### Design Decisions

#### Key Architectural Choices
1. **YJS for Real-time Sync**: CRDT-based conflict resolution without central coordination
2. **Better Auth Framework**: Flexible authentication with plugin architecture
3. **Express + React Router**: SSR with progressive enhancement
4. **PostgreSQL with Listen/Notify**: Real-time updates without polling

#### Trade-offs and Implications
1. **Memory-based Auth in Development** (`auth.ts:12-14`):
   - **Trade-off**: Simplicity vs. persistence
   - **Implication**: Sessions lost on restart in development
   - **Mitigation**: PostgreSQL adapter for production

2. **Workspace-based Document Isolation** (`yjs-server.ts:57-61`):
   - **Trade-off**: Memory usage vs. data isolation
   - **Implication**: Separate YJS document per workspace
   - **Benefit**: Better security and performance isolation

3. **Anonymous Session Auto-creation** (`server/app.ts:26-101`):
   - **Trade-off**: Complexity vs. user experience
   - **Implication**: All users tracked, even anonymous
   - **Benefit**: Seamless transition to authenticated state

#### Constraints and Limitations
- **WebSocket Timeout**: 30 seconds may be too short for slow clients
- **Session Duration**: 7 days requires re-authentication
- **Development Mode**: Memory-based auth not suitable for production
- **Error Recovery**: Limited automatic recovery for database disconnections

### Evolution Strategy

#### Extension Points and Interfaces
1. **Custom YJS Handlers**: Register new real-time endpoints via `yjsServer.use()`
2. **Model Layer**: Add new data models following existing patterns
3. **Middleware Pipeline**: Insert custom middleware in Express chain
4. **Authentication Plugins**: Extend Better Auth with custom providers

#### Modification Patterns
1. **Adding New Models**: Create handler factory in `/server/lib/models/`
2. **Custom Middleware**: Insert between auth and React Router layers
3. **WebSocket Handlers**: Register with path patterns for routing
4. **Error Types**: Extend `AuthError` class for domain errors

#### Growth and Scaling Approaches
1. **Horizontal Scaling**: Stateless HTTP with shared PostgreSQL
2. **WebSocket Scaling**: Redis adapter for multi-server YJS
3. **Database Scaling**: Read replicas for query distribution
4. **Caching Layer**: Redis for session and data caching
5. **Monitoring**: Expand `/api/yjs/stats` endpoint with metrics

## Critical Implementation Details

### Security Considerations
- Cookie-based sessions with httpOnly flag
- Anonymous users isolated with `@anonymous.local` domain
- WebSocket connections require valid session
- Error messages sanitized to prevent information leakage

### Performance Bottlenecks
- YJS document size growth over time
- Database listener connection limits
- WebSocket connection handling overhead
- Session validation on every request

### Monitoring and Observability
- Process memory usage tracking
- Active document count monitoring  
- Uptime and connection statistics
- Error logging with component context

### Production Readiness Checklist
- [ ] Replace memory-based auth with PostgreSQL adapter
- [ ] Configure production auth secret and base URL
- [ ] Implement Redis for WebSocket scaling
- [ ] Add connection pooling limits
- [ ] Set up structured logging
- [ ] Configure rate limiting
- [ ] Add health check endpoints
- [ ] Implement circuit breakers for external services

## Summary

The website server architecture demonstrates a well-structured, modern Node.js application with clear separation of concerns, comprehensive error handling, and sophisticated middleware patterns. The combination of traditional HTTP request processing with real-time WebSocket communication provides a flexible platform for collaborative features while maintaining code clarity and maintainability.

Key strengths include:
- **Robust middleware pipeline** with proper error boundaries
- **Comprehensive error handling** at every architectural layer
- **Performance optimizations** through caching and incremental updates
- **Clear extension points** for future development
- **Production-ready patterns** with development conveniences

Areas for improvement:
- Database connection resilience
- WebSocket scaling strategy
- Comprehensive monitoring
- Production authentication configuration

The architecture successfully balances complexity with maintainability, providing a solid foundation for a real-time collaborative web application.