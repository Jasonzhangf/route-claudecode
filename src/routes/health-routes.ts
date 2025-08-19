/**
 * 健康检查路由
 *
 * @author Jason Zhang
 */

export function createHealthRoutes() {
  return {
    '/health': (req: any, res: any) => res.json({ status: 'healthy' }),
    '/health/detailed': (req: any, res: any) => res.json({ status: 'healthy', details: {} }),
  };
}
