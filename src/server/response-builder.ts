/**
 * 响应构建器
 *
 * @author Jason Zhang
 */

export class ResponseBuilder {
  static success(data: any) {
    return { success: true, data };
  }

  static error(message: string, code?: number) {
    return { success: false, error: message, code };
  }
}
