/**
 * 管理员路由
 *
 * @author Jason Zhang
 */

export function createAdminRoutes() {
  return {
    '/admin': (req: any, res: any) => res.json({ admin: true }),
  };
}
