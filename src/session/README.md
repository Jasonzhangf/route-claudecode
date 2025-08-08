# Session Management Architecture

## Overview

The session management system provides basic request tracking and session management for the Claude Code Router. This system has been simplified to remove complex concurrency control while maintaining essential session tracking capabilities.

## Current Architecture

### SimpleSessionManager

**File**: `src/session/simple-session-manager.ts`

**Purpose**: Provides basic session tracking without concurrency control

**Key Features**:
- Request ID generation with session context
- Basic request lifecycle tracking (active → completed/failed)
- Session statistics and monitoring
- Automatic cleanup of expired sessions
- No queuing or concurrency control

**Usage**:
```typescript
import { getSimpleSessionManager } from '@/session/simple-session-manager';

const sessionManager = getSimpleSessionManager(port);

// Generate request ID
const requestId = sessionManager.generateRequestId(sessionId, conversationId, isStreaming);

// Track request completion
sessionManager.completeRequest(requestId, finishReason);

// Track request failure
sessionManager.failRequest(requestId, error);

// Get statistics
const stats = sessionManager.getSessionStats();
```

## Request ID Format

The simple session manager generates request IDs in the following format:
```
{sessionId}:{conversationId}:{counter}:{timestamp}:{random}
```

Example: `session1:conv1:1:1704067200000:a1b2`

## Integration Points

### OpenAI SDK Client

The OpenAI SDK client (`src/providers/openai/sdk-client.ts`) integrates with the simple session manager to:

1. Generate unique request IDs for session tracking
2. Track request lifecycle (start → complete/fail)
3. Provide session context in logs
4. Maintain basic statistics

### No Concurrency Control

Unlike the previous complex queue-based system, the current implementation:

- ✅ **Allows concurrent processing** of all requests
- ✅ **Provides session context** for debugging and monitoring
- ✅ **Tracks request lifecycle** for statistics
- ❌ **Does not enforce ordering** within conversations
- ❌ **Does not queue requests** for sequential processing

## Migration Notes

### Removed Components

The following components have been removed as part of the simplification:

- `conversation-queue-manager.ts` - Complex queue management with concurrency control
- `request-sequence-manager.ts` - Request sequencing and race condition detection

### Benefits of Simplification

1. **Performance**: No queuing overhead, true concurrent processing
2. **Simplicity**: Easier to understand and maintain
3. **Reliability**: Fewer moving parts, less chance of deadlocks
4. **Scalability**: Better handling of high-concurrency scenarios

### Trade-offs

1. **No Request Ordering**: Requests within the same conversation may complete out of order
2. **No Race Condition Detection**: System no longer detects or prevents race conditions
3. **Simplified Statistics**: Less detailed analytics compared to the previous system

## Configuration

The simple session manager requires minimal configuration:

- **Port**: Used to create port-specific manager instances
- **Cleanup Interval**: Automatic cleanup runs every 10 minutes
- **Expiration Threshold**: Sessions expire after 2 hours of inactivity

## Monitoring

The session manager provides the following statistics:

```typescript
interface SessionStats {
  totalSessions: number;      // Total number of sessions tracked
  activeRequests: number;     // Currently active requests
  completedRequests: number;  // Successfully completed requests
  failedRequests: number;     // Failed requests
}
```

## Future Considerations

If concurrency control is needed in the future, it can be re-implemented as:

1. **Optional Feature**: Configurable per provider or globally
2. **Pluggable Architecture**: Different session managers for different needs
3. **Hybrid Approach**: Simple tracking by default, complex control when needed

---

**Last Updated**: 2025-08-08  
**Version**: v2.9.0  
**Architecture**: Simplified Session Management