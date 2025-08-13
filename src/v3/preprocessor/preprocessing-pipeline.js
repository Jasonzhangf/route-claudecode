/**
 * 预处理管道 - v3.0 新架构
 * 使用类型驱动的预处理器系统，替代配置驱动的旧架构
 * 
 * Project owner: Jason Zhang
 */

import { PreprocessorManager } from './index.js';

export class PreprocessingPipeline {
  constructor(config = {}, debugSystem = null) {
    this.config = config;
    this.debugSystem = debugSystem;
    console.log('🔧 初始化v3.0类型驱动预处理管道...');
  }

  /**
   * 应用预处理到请求 - 新架构：基于Provider类型
   * @param {Object} request - 原始请求
   * @param {string} providerId - 目标Provider ID
   * @param {Object} context - 上下文信息
   * @returns {Object} 预处理后的请求
   */
  async preprocessRequest(request, providerId, context = {}) {
    let processedRequest = { ...request };

    // Record preprocessor input
    if (this.debugSystem?.debugComponents?.recorder) {
      this.debugSystem.debugComponents.recorder.recordLayerIO('preprocessor', 'input', {
        providerId,
        request: processedRequest,
        context
      }, {
        requestId: context.requestId,
        processingTime: 0,
        layer: 'preprocessor'
      });
    }

    // Get provider configuration
    const providerConfig = this.getProviderConfig(providerId);
    if (!providerConfig) {
      console.warn(`⚠️ Provider configuration not found for: ${providerId}, skipping preprocessing`);
      return processedRequest;
    }

    console.log(`🎯 使用类型驱动预处理器 (${providerConfig.type}) for Provider: ${providerId}`);

    try {
      // Create type-based preprocessor
      const preprocessor = PreprocessorManager.createPreprocessor(providerConfig.type, providerConfig);
      
      if (preprocessor && typeof preprocessor.processRequest === 'function') {
        const processingContext = {
          ...context,
          providerId,
          targetModel: context.targetModel,
          providerConfig
        };
        
        processedRequest = await preprocessor.processRequest(processedRequest, processingContext);
        console.log(`✅ 类型驱动预处理完成 (${providerConfig.type})`);
      } else {
        console.log(`ℹ️ 预处理器无需处理 (${providerConfig.type})`);
      }
      
    } catch (error) {
      console.error(`❌ 预处理器执行失败 (${providerConfig.type}):`, error.message);
      console.error(error.stack);
      // Continue with original request if preprocessor fails
    }

    // Record preprocessor output
    if (this.debugSystem?.debugComponents?.recorder) {
      this.debugSystem.debugComponents.recorder.recordLayerIO('preprocessor', 'output', {
        providerId,
        processedRequest,
        preprocessorType: providerConfig.type,
        processorsApplied: 1
      }, {
        requestId: context.requestId,
        processingTime: Date.now(),
        layer: 'preprocessor'
      });
    }

    return processedRequest;
  }

  /**
   * 应用后处理到响应 - 新架构：基于Provider类型
   * @param {Object} response - 原始响应
   * @param {Object} originalRequest - 原始请求
   * @param {string} providerId - Provider ID
   * @param {Object} context - 上下文信息
   * @returns {Object} 后处理的响应
   */
  async postprocessResponse(response, originalRequest, providerId, context = {}) {
    let processedResponse = { ...response };

    const providerConfig = this.getProviderConfig(providerId);
    if (!providerConfig) {
      return processedResponse;
    }

    console.log(`🔧 为Provider ${providerId} 应用响应后处理 (${providerConfig.type})`);

    try {
      // Create type-based preprocessor
      const preprocessor = PreprocessorManager.createPreprocessor(providerConfig.type, providerConfig);
      
      if (preprocessor && typeof preprocessor.postprocessResponse === 'function') {
        const processingContext = {
          ...context,
          providerId,
          providerConfig
        };

        processedResponse = await preprocessor.postprocessResponse(
          processedResponse, 
          originalRequest, 
          processingContext
        );
        console.log(`✅ ${providerConfig.type} 响应后处理完成`);
      }

    } catch (error) {
      console.error(`❌ 响应后处理器执行失败 (${providerConfig.type}):`, error.message);
      // Continue with original response if postprocessor fails
    }

    return processedResponse;
  }

  /**
   * 获取Provider配置
   * @param {string} providerId - Provider ID
   * @returns {Object|null} Provider配置
   */
  getProviderConfig(providerId) {
    if (this.config?.providers?.[providerId]) {
      return this.config.providers[providerId];
    }
    
    // 🔍 调试信息：帮助排查配置问题
    console.debug(`🔍 Provider配置查询: ${providerId}`, {
      hasConfig: !!this.config,
      hasProviders: !!this.config?.providers,
      availableProviders: this.config?.providers ? Object.keys(this.config.providers) : []
    });
    
    return null;
  }

  /**
   * 检查预处理器是否可用
   * @param {string} providerId - Provider ID
   * @returns {boolean} 是否有可用的预处理器
   */
  hasPreprocessor(providerId) {
    const providerConfig = this.getProviderConfig(providerId);
    if (!providerConfig) {
      return false;
    }

    try {
      const preprocessor = PreprocessorManager.createPreprocessor(providerConfig.type, providerConfig);
      return preprocessor && typeof preprocessor.processRequest === 'function';
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取预处理器信息
   * @param {string} providerId - Provider ID
   * @returns {Object} 预处理器信息
   */
  getPreprocessorInfo(providerId) {
    const providerConfig = this.getProviderConfig(providerId);
    if (!providerConfig) {
      return { available: false };
    }

    return {
      available: true,
      type: providerConfig.type,
      providerId,
      endpoint: providerConfig.endpoint
    };
  }
}