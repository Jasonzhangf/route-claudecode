/**
 * 错误处理协调中心工厂
 * 
 * 用于创建和配置错误处理协调中心实例
 * 
 * @author RCC v4.0
 */

import { ErrorCoordinationCenterImpl } from './error-coordination-center';
import { ErrorCoordinationConfig, PipelineManagerInterface, LoadBalancerInterface } from '../interfaces/core/error-coordination-center';

/**
 * 错误处理协调中心工厂类
 */
export class ErrorCoordinationCenterFactory {
  /**
   * 创建错误处理协调中心实例
   * 
   * @param config 配置选项
   * @param pipelineManager 流水线管理器
   * @param loadBalancer 负载均衡器
   * @returns 错误处理协调中心实例
   */
  static create(
    config?: Partial<ErrorCoordinationConfig>,
    pipelineManager?: PipelineManagerInterface,
    loadBalancer?: LoadBalancerInterface
  ): ErrorCoordinationCenterImpl {
    return new ErrorCoordinationCenterImpl(config, pipelineManager, loadBalancer);
  }

  /**
   * 创建默认的错误处理协调中心实例
   * 
   * @returns 默认配置的错误处理协调中心实例
   */
  static createDefault(): ErrorCoordinationCenterImpl {
    return new ErrorCoordinationCenterImpl();
  }

  /**
   * 创建用于测试的错误处理协调中心实例
   * 
   * @returns 测试配置的错误处理协调中心实例
   */
  static createForTesting(): ErrorCoordinationCenterImpl {
    return new ErrorCoordinationCenterImpl({
      enableRetryHandling: true,
      maxRetryAttempts: 2,
      retryDelayStrategy: 'fixed',
      baseRetryDelay: 100,
      maxRetryDelay: 1000,
      enablePipelineSwitching: true,
      enablePipelineDestruction: false, // 测试环境中不销毁流水线
      enableErrorClassification: true,
      enableLoadBalancerIntegration: true
    });
  }
}