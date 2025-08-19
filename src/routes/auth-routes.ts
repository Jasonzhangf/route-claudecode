/**
 * 认证路由
 *
 * @author Jason Zhang
 */

export function createAuthRoutes() {
  return {
    '/auth': (req: any, res: any) => res.json({ auth: true }),
  };
}
