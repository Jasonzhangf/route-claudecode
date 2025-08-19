export interface SessionInfo {
  sessionId: string;
  conversationId: string;
  requestId: string;
  timestamp: Date;
  priority: RequestPriority;
  clientInfo?: ClientInfo;
}

export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
  clientId?: string;
}

export type RequestPriority = 'high' | 'medium' | 'low';

export interface SessionManager {
  sessionId: string;
  conversations: Map<string, ConversationQueue>;
  createdAt: Date;
  lastActivity: Date;
  totalRequests: number;

  createConversation(conversationId: string): ConversationQueue;
  getConversation(conversationId: string): ConversationQueue | null;
  removeConversation(conversationId: string): boolean;
  cleanup(): Promise<void>;
  getMetrics(): SessionMetrics;
}

export interface ConversationQueue {
  conversationId: string;
  sessionId: string;
  requests: RequestProcessor[];
  isProcessing: boolean;
  createdAt: Date;
  lastActivity: Date;

  enqueue(request: RequestProcessor): Promise<void>;
  processNext(): Promise<void>;
  getCurrentStatus(): QueueStatus;
  getQueueLength(): number;
  clear(): void;
}

export interface RequestProcessor {
  requestId: string;
  sessionId: string;
  conversationId: string;
  request: RCCRequest;
  response?: RCCResponse;
  status: ProcessingStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: ProcessingError;

  process(): Promise<RCCResponse>;
  getMetrics(): ProcessingMetrics;
  abort(): Promise<void>;
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'aborted';

export interface QueueStatus {
  conversationId: string;
  queueLength: number;
  isProcessing: boolean;
  currentRequest?: string;
  waitTime?: number;
  estimatedProcessingTime?: number;
}

export interface ProcessingMetrics {
  requestId: string;
  processingTime?: number;
  queueWaitTime?: number;
  totalTime?: number;
  errorCount: number;
  retryCount: number;
}

export interface SessionMetrics {
  sessionId: string;
  totalConversations: number;
  totalRequests: number;
  averageProcessingTime: number;
  errorRate: number;
  activeConversations: number;
  uptime: number;
}

export interface FlowControlConfig {
  maxSessionsPerClient: number;
  maxConversationsPerSession: number;
  maxRequestsPerConversation: number;
  sessionTimeout: number; // milliseconds
  conversationTimeout: number; // milliseconds
  requestTimeout: number; // milliseconds
  priorityWeights: PriorityWeights;
  cleanupInterval: number; // milliseconds
}

export interface PriorityWeights {
  high: number;
  medium: number;
  low: number;
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: Date;
  retryable: boolean;
  context?: any;
}

export interface RCCRequest {
  id?: string;
  headers: Record<string, string>;
  body: any;
  method: string;
  url: string;
  timestamp?: Date;
}

export interface RCCResponse {
  id: string;
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: Date;
  processingTime: number;
}

export interface FlowControlMetrics {
  totalSessions: number;
  activeSessions: number;
  totalConversations: number;
  activeConversations: number;
  totalRequests: number;
  requestsInQueue: number;
  averageProcessingTime: number;
  averageQueueTime: number;
  errorRate: number;
  throughput: number; // requests per second
}

export interface SessionCleanupResult {
  sessionsRemoved: number;
  conversationsRemoved: number;
  requestsRemoved: number;
  memoryFreed: number; // bytes
}
