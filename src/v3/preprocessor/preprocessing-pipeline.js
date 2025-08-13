/**
 * 预处理管道 - 六层架构的预处理层
 * 根据配置动态加载和应用预处理器
 * 
 * Project owner: Jason Zhang
 */

import { LMStudioToolCompatibility } from './lmstudio-tool-compatibility.js';

export class PreprocessingPipeline {
  constructor(config = {}) {
    this.config = config;
    this.processors = new Map();
    this.initializeProcessors();
  }

  /**
   * 初始化预处理器
   */
  initializeProcessors() {
    console.log('🔧 初始化预处理管道...');

    // 注册LMStudio工具兼容性处理器
    if (this.config.preprocessing?.processors?.['lmstudio-tool-compatibility']?.enabled) {
      const lmStudioProcessor = new LMStudioToolCompatibility();
      this.processors.set('lmstudio-tool-compatibility', {
        processor: lmStudioProcessor,
        config: this.config.preprocessing.processors['lmstudio-tool-compatibility']
      });
      console.log('✅ LMStudio工具兼容性预处理器已注册');
    }

    console.log(`🎯 预处理管道初始化完成，共注册 ${this.processors.size} 个处理器`);
  }

  /**
   * 应用预处理到请求
   * @param {Object} request - 原始请求
   * @param {string} providerId - 目标Provider ID
   * @param {Object} context - 上下文信息
   * @returns {Object} 预处理后的请求
   */
  preprocessRequest(request, providerId, context = {}) {
    let processedRequest = { ...request };

    // 获取适用的处理器
    const applicableProcessors = this.getApplicableProcessors(providerId);

    if (applicableProcessors.length === 0) {
      return processedRequest;
    }

    console.log(`🔧 为Provider ${providerId} 应用 ${applicableProcessors.length} 个预处理器`);

    // 按顺序应用预处理器
    for (const { processor, config: processorConfig } of applicableProcessors) {
      try {
        const processingContext = {
          ...context,
          providerId,
          processorConfig
        };

        processedRequest = processor.preprocessRequest(processedRequest, processingContext);
        console.log(`✅ ${processor.processorName || 'Unknown'} 预处理完成`);

      } catch (error) {
        console.error(`❌ 预处理器 ${processor.processorName || 'Unknown'} 失败:`, error.message);
        // 继续处理其他预处理器，不中断流水线
      }
    }

    return processedRequest;
  }

  /**
   * 应用后处理到响应
   * @param {Object} response - 原始响应
   * @param {Object} originalRequest - 原始请求
   * @param {string} providerId - Provider ID
   * @param {Object} context - 上下文信息
   * @returns {Object} 后处理的响应
   */
  postprocessResponse(response, originalRequest, providerId, context = {}) {
    let processedResponse = { ...response };

    // 获取适用的处理器
    const applicableProcessors = this.getApplicableProcessors(providerId);

    if (applicableProcessors.length === 0) {
      return processedResponse;
    }

    console.log(`🔧 为Provider ${providerId} 应用 ${applicableProcessors.length} 个响应后处理器`);

    // 按顺序应用后处理器
    for (const { processor, config: processorConfig } of applicableProcessors) {
      try {
        if (typeof processor.postprocessResponse === 'function') {
          const processingContext = {
            ...context,
            providerId,
            processorConfig
          };

          processedResponse = processor.postprocessResponse(
            processedResponse, 
            originalRequest, 
            processingContext
          );
          console.log(`✅ ${processor.processorName || 'Unknown'} 响应后处理完成`);
        }

      } catch (error) {
        console.error(`❌ 响应后处理器 ${processor.processorName || 'Unknown'} 失败:`, error.message);
        // 继续处理其他后处理器
      }
    }

    return processedResponse;
  }

  /**
   * 获取适用于特定Provider的处理器
   * @param {string} providerId - Provider ID
   * @returns {Array} 适用的处理器列表
   */
  getApplicableProcessors(providerId) {
    const applicableProcessors = [];

    for (const [processorName, { processor, config }] of this.processors) {
      if (this.isProcessorApplicable(processorName, providerId, config)) {
        applicableProcessors.push({ processor, config });
      }
    }

    // 按order排序
    applicableProcessors.sort((a, b) => (a.config.order || 999) - (b.config.order || 999));

    return applicableProcessors;
  }

  /**
   * 检查处理器是否适用于特定Provider
   * @param {string} processorName - 处理器名称
   * @param {string} providerId - Provider ID
   * @param {Object} config - 处理器配置
   * @returns {boolean} 是否适用
   */
  isProcessorApplicable(processorName, providerId, config) {
    if (!config.enabled) {
      return false;
    }

    // 检查applyTo配置
    if (config.applyTo && Array.isArray(config.applyTo)) {
      return config.applyTo.some(pattern => {
        if (typeof pattern === 'string') {
          return providerId.toLowerCase().includes(pattern.toLowerCase());
        }
        return false;
      });
    }

    return true;
  }

  /**
   * 动态注册新的预处理器
   * @param {string} name - 处理器名称
   * @param {Object} processor - 处理器实例
   * @param {Object} config - 处理器配置
   */
  registerProcessor(name, processor, config = {}) {
    this.processors.set(name, { processor, config });
    console.log(`🔧 动态注册预处理器: ${name}`);
  }

  /**
   * 移除预处理器
   * @param {string} name - 处理器名称
   */
  unregisterProcessor(name) {
    if (this.processors.delete(name)) {
      console.log(`🗑️ 移除预处理器: ${name}`);
    }
  }

  /**
   * 获取管道信息
   * @returns {Object} 管道信息
   */
  getInfo() {
    const processorInfo = Array.from(this.processors.entries()).map(([name, { processor, config }]) => ({
      name,
      enabled: config.enabled,
      order: config.order || 999,
      applyTo: config.applyTo || 'all',
      processorInfo: typeof processor.getInfo === 'function' ? processor.getInfo() : null
    }));

    return {
      totalProcessors: this.processors.size,
      enabledProcessors: processorInfo.filter(p => p.enabled).length,
      processors: processorInfo
    };
  }
}

export default PreprocessingPipeline;