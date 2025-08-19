/**
 * 安全模块
 *
 * @author Jason Zhang
 */

export class SecurityManager {
  validateRequest(req: any): boolean {
    return true;
  }

  sanitizeInput(input: any): any {
    return input;
  }
}
