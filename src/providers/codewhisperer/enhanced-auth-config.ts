/**
 * CodeWhisperer 增强认证配置
 * 基于 AIClient-2-API 的多源凭据管理设计
 * 项目所有者: Jason Zhang
 */

export enum CredentialSource {
  BASE64 = 'base64',
  FILE_PATH = 'filePath',
  DIRECTORY_SCAN = 'directoryScan',
  ENVIRONMENT = 'environment',
  DEFAULT_PATH = 'defaultPath'
}

export enum AuthMethod {
  SOCIAL = 'social',
  IDC = 'idc'
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
  expiresAt?: string;
  profileArn?: string;
  region?: string;
  authMethod?: AuthMethod;
}

export interface CredentialConfig {
  // Base64 编码的凭据字符串
  base64Creds?: string;
  
  // 直接指定的文件路径
  credsFilePath?: string;
  
  // 凭据目录路径（用于扫描）
  credsDirPath?: string;
  
  // 优先级顺序
  priorityOrder?: CredentialSource[];
  
  // 环境变量前缀
  envPrefix?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
  timeoutMs: number;
}

export interface RegionConfig {
  region: string;
  refreshUrl?: string;
  refreshIDCUrl?: string;
  baseUrl?: string;
  amazonQUrl?: string;
}

export interface KiroAuthConfig {
  credentials: CredentialConfig;
  region?: RegionConfig;
  retry?: RetryConfig;
  authMethod?: AuthMethod;
  userAgent?: string;
  enableDebugLog?: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  backoffMultiplier: 2,
  retryableStatuses: [429, 500, 502, 503, 504],
  timeoutMs: 120000
};

export const DEFAULT_REGION_CONFIG: RegionConfig = {
  region: 'us-east-1',
  refreshUrl: 'https://prod.{{region}}.auth.desktop.kiro.dev/refreshToken',
  refreshIDCUrl: 'https://oidc.{{region}}.amazonaws.com/token',
  baseUrl: 'https://codewhisperer.{{region}}.amazonaws.com/generateAssistantResponse',
  amazonQUrl: 'https://codewhisperer.{{region}}.amazonaws.com/SendMessageStreaming'
};

export const DEFAULT_CREDENTIAL_CONFIG: CredentialConfig = {
  priorityOrder: [
    CredentialSource.BASE64,
    CredentialSource.FILE_PATH,
    CredentialSource.DIRECTORY_SCAN,
    CredentialSource.ENVIRONMENT,
    CredentialSource.DEFAULT_PATH
  ],
  envPrefix: 'KIRO_'
};

export const KIRO_AUTH_TOKEN_FILE = 'kiro-auth-token.json';