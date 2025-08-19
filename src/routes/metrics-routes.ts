/**
 * 指标路由
 *
 * @author Jason Zhang
 */

export function createMetricsRoutes() {
  return {
    '/metrics': (req: any, res: any) => res.json({ metrics: {} }),
  };
}
