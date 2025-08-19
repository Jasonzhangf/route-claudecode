/**
 * Provider路由
 *
 * @author Jason Zhang
 */

export function createProviderRoutes() {
  return {
    '/providers': (req: any, res: any) => res.json({ providers: [] }),
  };
}
