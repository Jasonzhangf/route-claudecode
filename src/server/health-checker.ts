/**
 * 健康检查器
 *
 * @author Jason Zhang
 */

export class HealthChecker {
  async check(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: true, details: { status: 'ok' } };
  }
}
