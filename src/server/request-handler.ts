/**
 * 请求处理器
 *
 * @author Jason Zhang
 */

export class RequestHandler {
  async handle(req: any, res: any): Promise<void> {
    // 基础请求处理
    res.json({ status: 'ok' });
  }
}
