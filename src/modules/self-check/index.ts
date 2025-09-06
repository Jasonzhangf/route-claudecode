/**
 * 自检模块入口文件
 *
 * 导出自检模块的所有公共接口和组件
 *
 * @author Jason Zhang
 * @version 4.0.0
 */

// 导出类型定义
export type {
  ApiKeyInfo,
  PipelineCheckResult,
  AuthCheckResult,
  SelfCheckConfig,
  SelfCheckState,
  ApiKeyStatus,
  AuthStatus,
  PipelineCheckStatus
} from './self-check-types';

// 导出接口
export type { ISelfCheckModule } from './self-check.interface';

// 导出实现类
export { SelfCheckService } from './self-check.service';

// 导出工厂类
export { SelfCheckModuleFactory } from './self-check.factory';

// 模块版本信息
export const SELF_CHECK_MODULE_VERSION = '4.0.0';