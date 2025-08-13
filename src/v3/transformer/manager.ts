/**
 * V3.0 Transformers Manager
 * 负责根据provider类型选择合适的transformer进行请求和响应转换
 */

interface TransformationContext {
  provider: string;
  direction: 'input' | 'output';
  requestId?: string;
  originalRequest?: any;
}

class TransformationManager {
  private transformers: Map<string, any> = new Map();

  constructor() {
    // 懒加载transformers，避免循环依赖
  }

  /**
   * 动态加载和缓存transformer
   */
  private async getTransformer(providerType: string): Promise<any> {
    if (this.transformers.has(providerType)) {
      return this.transformers.get(providerType);
    }

    try {
      if (providerType === 'gemini') {
        const { GeminiTransformer } = await import('./gemini-transformer.js');
        const transformer = new GeminiTransformer();
        this.transformers.set(providerType, transformer);
        return transformer;
      }
      
      // 其他provider类型可以在这里添加
      
      return null;
    } catch (error) {
      console.error(`Failed to load transformer for ${providerType}:`, error.message);
      return null;
    }
  }

  /**
   * 转换输入请求（Anthropic → Provider格式）
   */
  async transformInput(data: any, context: TransformationContext): Promise<any> {
    console.log(`🔄 [${context.requestId}] Transforming input for ${context.provider}`);
    
    const transformer = await this.getTransformer(context.provider);
    
    if (!transformer) {
      console.warn(`No transformer found for provider: ${context.provider}, using passthrough`);
      return data;
    }

    try {
      if (context.provider === 'gemini' && transformer.transformAnthropicToGemini) {
        return transformer.transformAnthropicToGemini(data);
      }
      
      // 默认直接返回
      return data;
    } catch (error) {
      console.error(`Input transformation failed for ${context.provider}:`, error.message);
      return data; // 失败时返回原始数据
    }
  }

  /**
   * 转换输出响应（Provider格式 → Anthropic）
   */
  async transformOutput(data: any, context: TransformationContext): Promise<any> {
    console.log(`🔄 [${context.requestId}] Transforming output for ${context.provider}`);
    
    const transformer = await this.getTransformer(context.provider);
    
    if (!transformer) {
      console.warn(`No transformer found for provider: ${context.provider}, using passthrough`);
      return data;
    }

    try {
      if (context.provider === 'gemini' && transformer.transformGeminiToAnthropic) {
        return transformer.transformGeminiToAnthropic(data, context.originalRequest);
      }
      
      // 默认直接返回
      return data;
    } catch (error) {
      console.error(`Output transformation failed for ${context.provider}:`, error.message);
      return data; // 失败时返回原始数据
    }
  }

  /**
   * 转换流式响应
   */
  async *transformStream(stream: AsyncIterable<any>, context: TransformationContext): AsyncIterable<any> {
    console.log(`🔄 [${context.requestId}] Transforming stream for ${context.provider}`);
    
    const transformer = await this.getTransformer(context.provider);
    
    if (!transformer) {
      console.warn(`No transformer found for provider: ${context.provider}, using passthrough`);
      for await (const chunk of stream) {
        yield chunk;
      }
      return;
    }

    try {
      if (context.provider === 'gemini' && transformer.transformGeminiStreamToAnthropicStream) {
        for await (const chunk of stream) {
          const transformedChunk = transformer.transformGeminiStreamToAnthropicStream(chunk);
          yield transformedChunk;
        }
      } else {
        // 默认passthrough
        for await (const chunk of stream) {
          yield chunk;
        }
      }
    } catch (error) {
      console.error(`Stream transformation failed for ${context.provider}:`, error.message);
      // 流式错误需要抛出，不能静默处理
      throw error;
    }
  }

  /**
   * 获取支持的transformer列表
   */
  getTransformers(): string[] {
    return ['gemini', 'v3-default'];
  }

  /**
   * 注册自定义transformer
   */
  registerTransformer(name: string, transformer: any): void {
    console.log(`📝 Registered transformer: ${name}`);
    this.transformers.set(name, transformer);
  }

  /**
   * 检查是否支持某个provider的转换
   */
  async supportsProvider(providerType: string): Promise<boolean> {
    if (providerType === 'gemini') {
      return true;
    }
    
    // 其他provider检查
    return false;
  }
}

export const transformationManager = new TransformationManager();