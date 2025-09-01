/**
 * Router API Module - 路由器API模块
 * 
 * 将现有的路由逻辑包装为REST API端点，支持Phase 2的API化改造
 * 
 * @author RCC v4.0 Phase 2 Implementation
 */

import { secureLogger } from '../../utils/secure-logger';
import { PipelineLayersProcessor, RequestContext } from '../../pipeline/modules/pipeline-layers';

/**
 * 路由API处理器
 * 包装现有的PipelineLayersProcessor路由功能
 */
export class RouterAPIProcessor {
  private pipelineProcessor: PipelineLayersProcessor;

  constructor(pipelineProcessor: PipelineLayersProcessor) {
    this.pipelineProcessor = pipelineProcessor;
    
    secureLogger.info('Router API Processor initialized', {
      hasProcessor: !!pipelineProcessor
    });
  }

  /**
   * 处理路由API请求
   */
  async processRoute(input: any, context: RequestContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      secureLogger.info('Processing route via API wrapper', {
        requestId: context.requestId,
        inputModel: input?.model
      });

      // 调用现有的路由处理逻辑
      const result = await this.pipelineProcessor.processRouterLayer(input, context);
      
      const processingTime = Date.now() - startTime;
      
      secureLogger.info('Route processing completed via API', {
        requestId: context.requestId,
        processingTime,
        hasResult: !!result
      });

      return {
        output: result,
        context,
        processingTime,
        layerInfo: {
          name: 'router',
          type: 'routing-decision',
          status: 'success'
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      secureLogger.error('Route processing failed via API', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      throw error;
    }
  }
}

/**
 * 创建路由API处理器实例
 */
export function createRouterAPIProcessor(pipelineProcessor: PipelineLayersProcessor): RouterAPIProcessor {
  return new RouterAPIProcessor(pipelineProcessor);
}