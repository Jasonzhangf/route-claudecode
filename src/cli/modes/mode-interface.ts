// ProcessingMetrics is defined locally in this file

export interface CLIModeInterface {
  name: string;
  description: string;
  start(options: ModeOptions): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ModeStatus;
  healthCheck(): Promise<HealthStatus>;
}

export interface ModeOptions {
  port?: number;
  config?: string;
  debug?: boolean;
  provider?: string;
  model?: string;
  autoStart?: boolean;
}

export interface ServerModeOptions extends ModeOptions {
  port: number;
  config?: string;
  debug?: boolean;
  host?: string;
}

export interface ClientModeOptions extends ModeOptions {
  provider?: string;
  model?: string;
  autoStart?: boolean;
  proxyPort?: number;
}

export interface ModeStatus {
  mode: string;
  isRunning: boolean;
  pid?: number;
  uptime?: number;
  port?: number;
  lastError?: string;
}

export interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  details: {
    server?: ServerHealth;
    proxy?: ProxyHealth;
    connections?: ConnectionHealth;
  };
}

export interface ServerHealth {
  listening: boolean;
  port: number;
  activeConnections: number;
  memoryUsage: number;
}

export interface ProxyHealth {
  connected: boolean;
  targetProcess?: string;
  proxyPort?: number;
}

export interface ConnectionHealth {
  providers: ProviderConnectionStatus[];
  totalRequests: number;
  errorRate: number;
}

export interface ProviderConnectionStatus {
  provider: string;
  connected: boolean;
  latency?: number;
  lastCheck: Date;
}

export interface ProcessingMetrics {
  requestCount: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
}

export interface ProxyManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ProxyStatus;
  configureTarget(target: ProxyTarget): Promise<void>;
}

export interface ProxyStatus {
  active: boolean;
  targetPid?: number;
  proxyPort: number;
  interceptedRequests: number;
}

export interface ProxyTarget {
  processName: string;
  targetUrl: string;
  proxyUrl: string;
  targetProcess?: string;
  proxyPort?: number;
  rccServerUrl?: string;
}

export interface LifecycleManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  monitorHealth(): Promise<HealthStatus>;
  handleShutdown(): Promise<void>;
}
