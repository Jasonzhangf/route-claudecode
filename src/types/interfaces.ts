/**
 * MOCKUP IMPLEMENTATION - Core Interfaces
 * This is a placeholder implementation for the six-layer architecture
 * All functionality is mocked and should be replaced with real implementations
 */

export interface LayerInterface {
  name: string;
  version: string;
  dependencies: string[];
  process(input: any, context: ProcessingContext): Promise<any>;
  healthCheck(): Promise<boolean>;
  getLayerCapabilities(): LayerCapabilities;
}

export interface ProcessingContext {
  requestId: string;
  timestamp: Date;
  metadata: Record<string, any>;
  debugEnabled: boolean;
}

export interface LayerCapabilities {
  supportedFormats: string[];
  features: string[];
  version: string;
}

export interface ProviderClient {
  // Core processing methods
  processRequest(request: AIRequest): Promise<AIResponse>;
  healthCheck(): Promise<ProviderHealth>;
  authenticate(): Promise<AuthResult>;
  getModels(): Promise<ModelInfo[]>;
  
  // Provider information
  getName(): string;
  getVersion(): string;
  getEndpoint(): string;
  
  // Configuration and lifecycle
  initialize(config: ProviderConfig): Promise<void>;
  shutdown(): Promise<void>;
  
  // Token and authentication management
  refreshToken(): Promise<AuthResult>;
  validateToken(): Promise<boolean>;
  
  // Format conversion support
  convertRequest(request: AIRequest, targetFormat: string): Promise<any>;
  convertResponse(response: any, sourceFormat: string): Promise<AIResponse>;
  
  // Error handling and retry logic
  handleError(error: any): ProviderError;
  shouldRetry(error: ProviderError): boolean;
}

export interface AIRequest {
  id: string;
  provider: string;
  model: string;
  messages: Message[];
  tools?: Tool[];
  stream?: boolean;
  metadata: RequestMetadata;
}

export interface AIResponse {
  id: string;
  model: string;
  choices: Choice[];
  usage?: Usage;
  metadata: ResponseMetadata;
}

export interface Message {
  role: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface Choice {
  index: number;
  message: Message;
  finishReason?: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface RequestMetadata {
  timestamp: Date;
  source: string;
  priority: number;
}

export interface ResponseMetadata {
  timestamp: Date;
  processingTime: number;
  provider: string;
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  lastCheck: Date;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  maxTokens?: number;
  contextWindow?: number;
  pricing?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ProviderConfig {
  name: string;
  type: string;
  endpoint: string;
  apiKey?: string;
  models: string[];
  timeout?: number;
  retryAttempts?: number;
  healthCheckInterval?: number;
  authentication?: {
    type: 'api-key' | 'oauth' | 'bearer';
    refreshUrl?: string;
    tokenExpiry?: number;
  };
}

export interface ProviderError {
  code: string;
  message: string;
  type: 'authentication' | 'rate-limit' | 'network' | 'validation' | 'server' | 'unknown';
  retryable: boolean;
  retryAfter?: number;
  originalError?: any;
}

export interface DebugRecorder {
  recordInput(layerName: string, data: any, metadata: RecordMetadata): void;
  recordOutput(layerName: string, data: any, metadata: RecordMetadata): void;
  getRecordings(filter: RecordingFilter): Promise<Recording[]>;
  replayScenario(scenarioId: string): Promise<ReplayResult>;
}

export interface RecordMetadata {
  timestamp: Date;
  requestId: string;
  layerName: string;
  operation: string;
}

export interface Recording {
  id: string;
  timestamp: Date;
  layer: string;
  type: 'input' | 'output';
  data: any;
  metadata: RecordMetadata;
  context: ProcessingContext;
}

export interface RecordingFilter {
  layerName?: string;
  requestId?: string;
  startTime?: Date;
  endTime?: Date;
  type?: 'input' | 'output';
}

export interface ReplayResult {
  success: boolean;
  scenarioId: string;
  steps: ReplayStep[];
  error?: string;
}

export interface ReplayStep {
  layer: string;
  input: any;
  output: any;
  success: boolean;
  error?: string;
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Core interfaces loaded - placeholder implementation');