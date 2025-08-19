/**
 * 核心模块接口统一导出
 *
 * 这个文件是RCC v4.0模块化架构的核心，定义了所有模块必须遵循的标准接口
 * 所有模块间的通信都必须通过这些接口进行，严禁直接调用具体实现
 *
 * @author Jason Zhang
 */

// 基础模块接口
export * from './module-interface';

// 客户端模块接口
export * from './client-interface';

// 路由器模块接口
export * from './router-interface';

// Debug系统接口
export * from './debug-interface';

// 服务器模块接口
export * from './server-interface';

// 中间件接口
export * from './middleware-interface';

// 模块实现接口
export { IModuleInterface, IModuleStatus, IModuleMetrics } from './module-implementation-interface';

/**
 * 模块接口版本信息
 */
export const MODULE_INTERFACE_VERSION = '4.0.0-alpha.1';

/**
 * 支持的模块类型列表
 */
export const SUPPORTED_MODULE_TYPES = ['client', 'router', 'pipeline', 'debug', 'server'] as const;

/**
 * 模块依赖关系图
 * 定义模块间的允许依赖关系
 */
export const MODULE_DEPENDENCY_GRAPH = {
  client: ['router', 'server'], // 客户端可以依赖路由器和服务器接口
  router: ['pipeline', 'debug'], // 路由器可以依赖流水线和Debug接口
  pipeline: ['debug'], // 流水线可以依赖Debug接口
  debug: [], // Debug系统不依赖其他模块
  server: ['pipeline', 'debug'], // 服务器可以依赖流水线和Debug接口
} as const;

/**
 * 验证模块依赖是否合法
 * @param sourceModule 源模块类型
 * @param targetModule 目标模块类型
 * @returns boolean 是否允许依赖
 */
export function validateModuleDependency(sourceModule: string, targetModule: string): boolean {
  const allowedDependencies = MODULE_DEPENDENCY_GRAPH[sourceModule as keyof typeof MODULE_DEPENDENCY_GRAPH];
  return allowedDependencies ? (allowedDependencies as readonly string[]).includes(targetModule) : false;
}

/**
 * 检查是否存在循环依赖
 * @param dependencies 依赖关系映射
 * @returns string[] 循环依赖路径，空数组表示无循环依赖
 */
export function detectCircularDependencies(dependencies: Record<string, string[]>): string[] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    if (recursionStack.has(node)) {
      return true; // 找到循环
    }

    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const deps = dependencies[node] || [];
    for (const dep of deps) {
      if (dfs(dep)) {
        return true;
      }
    }

    recursionStack.delete(node);
    path.pop();
    return false;
  }

  for (const node of Object.keys(dependencies)) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        return [...path];
      }
    }
  }

  return [];
}
