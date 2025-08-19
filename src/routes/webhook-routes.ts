/**
 * Webhook路由
 *
 * @author Jason Zhang
 */

export function createWebhookRoutes() {
  return {
    '/webhook': (req: any, res: any) => res.json({ webhook: true }),
  };
}
