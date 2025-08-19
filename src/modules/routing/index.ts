/**
 * 路由模块导出文件
 *
 * 提供统一的路由功能入口，只导出核心路由器
 *
 * @author RCC4 Core Router Team
 * @version 4.0.0-beta.1
 */

export { CoreRouter } from './core-router';

// 重新导出接口定义，保持API一致性
export * from '../../interfaces/router/core-router-interfaces';
