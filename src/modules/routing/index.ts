/**
 * 路由模块导出文件
 *
 * 提供统一的路由功能入口，重定向到主要路由器
 *
 * @author RCC4 Core Router Team
 * @version 4.0.0-beta.1
 * @deprecated 请使用 router/pipeline-router.ts 中的 PipelineRouter
 */

// 重定向到主要路由器
export { PipelineRouter as CoreRouter } from '../../router/pipeline-router';

// 重新导出主要路由接口
export * from '../../router/pipeline-router';
