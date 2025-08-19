/**
 * 调试路由
 *
 * @author Jason Zhang
 */

export function createDebugRoutes() {
  return {
    '/debug': (req: any, res: any) => res.json({ debug: true }),
  };
}
