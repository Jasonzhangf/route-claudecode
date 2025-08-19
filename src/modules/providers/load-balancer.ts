/**
 * Provider负载均衡器 - 重构入口文件
 *
 * 此文件已重构为模块化实现，原有896行代码已拆分为多个独立模块
 * 保持向后兼容性，导出重构后的实现
 *
 * @author Jason Zhang
 * @deprecated 请使用 load-balancer/ 目录下的模块化实现
 */

// 重新导出所有内容以保持向后兼容性
export * from './load-balancer/load-balancer';
export * from './load-balancer/strategies';
export * from './load-balancer/health-checker';
export * from './load-balancer/circuit-breaker';
export * from './load-balancer/metrics-collector';
export * from './load-balancer/session-manager';

/**
 * 重构说明：
 *
 * 原始896行文件已重构为以下模块：
 *
 * 1. types.ts - 类型定义和接口 (187行)
 * 2. strategies.ts - 负载均衡策略实现 (289行)
 * 3. health-checker.ts - 健康检查器 (191行)
 * 4. circuit-breaker.ts - 熔断器实现 (235行)
 * 5. metrics-collector.ts - 指标收集器 (267行)
 * 6. session-manager.ts - 会话管理器 (242行)
 * 7. load-balancer.ts - 主负载均衡器 (285行)
 *
 * 每个模块：
 * - 单一职责原则
 * - 清晰的接口定义
 * - 依赖注入设计
 * - 完整的错误处理
 * - 详细的日志记录
 *
 * 优势：
 * - 代码可维护性提升
 * - 模块间低耦合
 * - 易于单元测试
 * - 支持独立功能扩展
 * - 符合TypeScript最佳实践
 */
