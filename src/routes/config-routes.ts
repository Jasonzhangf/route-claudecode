/**
 * 配置路由
 *
 * @author Jason Zhang
 */

export function createConfigRoutes() {
  return {
    '/config': (req: any, res: any) => res.json({ config: {} }),
  };
}
