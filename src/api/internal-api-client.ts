import { APIResponse } from './types/api-response';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { API_DEFAULTS } from '../constants/api-defaults';
import { secureLogger } from '../utils/secure-logger';

export interface InternalAPIClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

export class InternalAPIClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(config: InternalAPIClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || API_DEFAULTS.HTTP_CONFIG.INTERNAL_API_TIMEOUT;
    this.retries = config.retries || API_DEFAULTS.HTTP_CONFIG.API_RETRY_DELAYS.MAX_ATTEMPTS - 1;
  }

  async post<T>(endpoint: string, data: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>('POST', endpoint, data);
  }

  async get<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>('GET', endpoint);
  }

  async put<T>(endpoint: string, data: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>('PUT', endpoint, data);
  }

  async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>('DELETE', endpoint);
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error;

    for (let i = 0; i <= this.retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        };

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JQJsonHandler.stringifyJson(data);
        }

        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: APIResponse<T> = await response.json();
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // 如果是最后一次尝试，不再重试
        if (i >= this.retries) {
          break;
        }
        
        // 区分不同类型的错误，使用适当的退避策略
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        const isTimeoutError = isAbortError || (error instanceof Error && error.message.includes('aborted'));
        
        // 计算退避延迟时间
        const baseDelay = API_DEFAULTS.HTTP_CONFIG.API_RETRY_DELAYS.BASE_DELAY;
        const multiplier = isTimeoutError 
          ? API_DEFAULTS.HTTP_CONFIG.API_RETRY_DELAYS.TIMEOUT_MULTIPLIER
          : 1;
        const backoffTime = Math.pow(2, i) * baseDelay * multiplier;
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    throw new Error(`Request failed after ${this.retries + 1} attempts: ${lastError?.message}`);
  }
}

// 创建API客户端实例
export function createInternalAPIClient(config: InternalAPIClientConfig): InternalAPIClient {
  return new InternalAPIClient(config);
}