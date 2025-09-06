/**
 * 四层双向处理架构接口定义
 * 
 * 定义RCC v4.0四层流水线架构中各层的双向处理接口
 * - Transformer ↔ Protocol ↔ ServerCompatibility ↔ Server
 * 
 * @author RCC v4.0 Architecture
 * @version 1.0.0
 */

/**
 * 请求处理上下文
 */
export interface RequestContext {
  requestId: string;
  providerId?: string;
  modelName?: string;
  processingLayer?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

/**
 * 响应处理上下文
 */
export interface ResponseContext {
  requestId: string;
  providerId?: string;
  modelName?: string;
  processingLayer?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
  processingTime?: number;
}

/**
 * 基础双向处理器接口
 */
export interface BidirectionalProcessor {
  processRequest(input: any, context?: RequestContext): Promise<any>;
  processResponse(input: any, context?: ResponseContext): Promise<any>;
}

/**
 * Transformer层双向处理器
 */
export interface BidirectionalTransformer extends BidirectionalProcessor {
  transformRequest(input: any, context?: RequestContext): Promise<any>;
  transformResponse(input: any, context?: ResponseContext): Promise<any>;
}

/**
 * Protocol层双向处理器
 */
export interface BidirectionalProtocolProcessor extends BidirectionalProcessor {
  processStreamRequest?(input: any, context?: RequestContext): Promise<any>;
  processStreamResponse?(input: any, context?: ResponseContext): Promise<any>;
}

/**
 * ServerCompatibility层双向处理器
 */
export interface BidirectionalCompatibilityProcessor extends BidirectionalProcessor {
  adjustRequest?(input: any, context?: RequestContext): Promise<any>;
  adjustResponse?(input: any, context?: ResponseContext): Promise<any>;
}

/**
 * Server层双向处理器
 */
export interface BidirectionalServerProcessor extends BidirectionalProcessor {
  sendRequest?(input: any, context?: RequestContext): Promise<any>;
  receiveResponse?(input: any, context?: ResponseContext): Promise<any>;
}

/**
 * 四层流水线处理器接口
 */
export interface FourLayerPipelineProcessor {
  transformer: BidirectionalTransformer;
  protocol: BidirectionalProtocolProcessor;
  serverCompatibility: BidirectionalCompatibilityProcessor;
  server: BidirectionalServerProcessor;
}