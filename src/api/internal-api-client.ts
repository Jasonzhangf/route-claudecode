import { APIResponse } from './types/api-response';
import { JQJsonHandler } from '../utils/jq-json-handler';

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
    this.timeout = config.timeout || 5000;
    this.retries = config.retries || 3;
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
        if (i < this.retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
        }
      }
    }

    throw new Error(`Request failed after ${this.retries + 1} attempts: ${lastError?.message}`);
  }
}

// 创建API客户端实例
export function createInternalAPIClient(config: InternalAPIClientConfig): InternalAPIClient {
  return new InternalAPIClient(config);
}