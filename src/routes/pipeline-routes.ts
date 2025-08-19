/**
 * 流水线路由
 *
 * @author Jason Zhang
 */

export function createPipelineRoutes() {
  return {
    '/pipeline': (req: any, res: any) => res.json({ pipelines: [] }),
  };
}
