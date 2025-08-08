/**
 * Modular Preprocessing Manager
 * 模块化预处理管理器
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';

export class ModularPreprocessingManager {
  constructor(private port?: number) {}

  /**
   * 预处理请求
   */
  async preprocessRequest(request: BaseRequest): Promise<BaseRequest> {
    try {
      // 基础预处理逻辑
      const processedRequest = { ...request };
      
      // 确保metadata存在
      if (!processedRequest.metadata) {
        processedRequest.metadata = {
          requestId: 'unknown'
        };
      }

      return processedRequest;
    } catch (error) {
      logger.error('Request preprocessing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 预处理响应
   */
  async preprocessResponse(response: BaseResponse): Promise<BaseResponse> {
    try {
      // 基础响应预处理
      return response;
    } catch (error) {
      logger.error('Response preprocessing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export function getModularPreprocessingManager(port?: number): ModularPreprocessingManager {
  return new ModularPreprocessingManager(port);
}