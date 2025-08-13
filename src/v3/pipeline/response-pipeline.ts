/**
 * V3.0 Response Pipeline with LM Studio Buffered Processing
 * 
 * @author Jason Zhang
 */

import { LMStudioBufferedProcessor } from '../provider/openai-compatible/lmstudio-buffered-processor.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

export interface PipelineContext {
  requestId: string;
  provider: string;
  model: string;
  isStreaming: boolean;
  timestamp: number;
}

export class ResponsePipeline {
  private lmStudioProcessor: LMStudioBufferedProcessor;
  private debugSystem: any;
  
  constructor(debugSystem?: any) {
    this.lmStudioProcessor = new LMStudioBufferedProcessor();
    this.debugSystem = debugSystem;
    logger.info('V3 ResponsePipeline initialized with LM Studio buffered processing');
  }
  
  async process(response: any, context: PipelineContext): Promise<any> {
    logger.debug('Processing response through pipeline', {
      provider: context.provider,
      model: context.model,
      isStreaming: context.isStreaming,
      responseType: typeof response
    }, context.requestId);
    
    // Record pipeline input
    if (this.debugSystem && this.debugSystem.debugComponents?.recorder) {
      this.debugSystem.debugComponents.recorder.recordLayerIO('pipeline', 'input', {
        provider: context.provider,
        model: context.model,
        response: response,
        isStreaming: context.isStreaming
      }, {
        requestId: context.requestId,
        processingTime: Date.now() - context.timestamp,
        layer: 'pipeline'
      });
    }
    
    try {
      // 检查是否为 LM Studio provider 或包含 LM Studio 特征的响应
      if (this.shouldApplyLMStudioProcessing(response, context)) {
        logger.info('Applying LM Studio buffered processing', {
          provider: context.provider,
          model: context.model
        }, context.requestId);
        
        // 应用 LM Studio 缓冲处理
        const processedResponse = await this.lmStudioProcessor.process(response, {
          sessionId: 'pipeline-session',
          requestId: context.requestId,
          timestamp: new Date(context.timestamp),
          metadata: { 
            layer: 'transformer', 
            processingTime: Date.now() - context.timestamp,
            provider: context.provider,
            model: context.model
          },
          debugEnabled: true
        });
        
        logger.debug('LM Studio buffered processing completed', {
          originalEventCount: response.events?.length || 0,
          processedEventCount: processedResponse.events?.length || 0,
          hasToolExtraction: this.hasToolExtractionEvidence(processedResponse)
        }, context.requestId);
        
        // Record pipeline output (LM Studio processed)
        if (this.debugSystem && this.debugSystem.debugComponents?.recorder) {
          this.debugSystem.debugComponents.recorder.recordLayerIO('pipeline', 'output', {
            provider: context.provider,
            model: context.model,
            processedResponse: processedResponse,
            lmStudioProcessed: true
          }, {
            requestId: context.requestId,
            processingTime: Date.now() - context.timestamp,
            layer: 'pipeline'
          });
        }
        
        return processedResponse;
      }
      
      // Record pipeline output (no processing)
      if (this.debugSystem && this.debugSystem.debugComponents?.recorder) {
        this.debugSystem.debugComponents.recorder.recordLayerIO('pipeline', 'output', {
          provider: context.provider,
          model: context.model,
          response: response,
          lmStudioProcessed: false
        }, {
          requestId: context.requestId,
          processingTime: Date.now() - context.timestamp,
          layer: 'pipeline'
        });
      }
      
      // 对于非 LM Studio 响应，直接返回
      return response;
      
    } catch (error) {
      logger.error('Error in response pipeline processing', {
        error: error instanceof Error ? error.message : String(error),
        provider: context.provider,
        model: context.model
      }, context.requestId);
      
      // 如果处理失败，返回原始响应
      return response;
    }
  }
  
  /**
   * 判断是否应该应用 LM Studio 处理
   */
  private shouldApplyLMStudioProcessing(response: any, context: PipelineContext): boolean {
    logger.debug('Checking if LM Studio processing should be applied', {
      provider: context.provider,
      responseType: typeof response,
      hasData: !!(response && response.data),
      hasEvents: !!(response && response.events),
      responseKeys: response && typeof response === 'object' ? Object.keys(response) : []
    }, context.requestId);
    
    // 1. 检查 provider 名称
    const providerName = context.provider.toLowerCase();
    if (providerName.includes('lmstudio') || providerName.includes('lm-studio')) {
      logger.debug('LM Studio detected by provider name', { providerName }, context.requestId);
      return true;
    }
    
    // 2. 检查端口（LM Studio 通常在 5506 端口）
    if (providerName.includes('5506')) {
      logger.debug('LM Studio detected by port 5506', { providerName }, context.requestId);
      return true;
    }
    
    // 3. 检查响应内容特征
    if (typeof response === 'string' && response.includes('Tool call:')) {
      logger.debug('LM Studio detected by string content', {}, context.requestId);
      return true;
    }
    
    if (response && response.events && Array.isArray(response.events)) {
      const hasToolCalls = response.events.some((event: any) => 
        event.choices?.[0]?.delta?.content?.includes('Tool call:')
      );
      if (hasToolCalls) {
        logger.debug('LM Studio detected by events content', {}, context.requestId);
        return true;
      }
    }
    
    // 4. 检查数据结构特征
    if (response && response.data && typeof response.data === 'string' && response.data.includes('Tool call:')) {
      logger.debug('LM Studio detected by data content', {}, context.requestId);
      return true;
    }
    
    logger.debug('LM Studio processing not applied', {
      provider: context.provider,
      responseType: typeof response
    }, context.requestId);
    
    return false;
  }
  
  /**
   * 检查响应是否有工具提取的证据
   */
  private hasToolExtractionEvidence(response: any): boolean {
    if (!response.events || !Array.isArray(response.events)) {
      return false;
    }
    
    return response.events.some((event: any) => 
      event.event === 'content_block_start' && 
      event.data?.content_block?.type === 'tool_use'
    );
  }
}