/**
 * 健康检查器
 *
 * @author Jason Zhang
 */

/**
 * 健康检查结果类型
 */
export interface HealthCheckResult {
  healthy: boolean;
  details: any;
}

export class HealthChecker {
  async check(): Promise<HealthCheckResult> {
    return { healthy: true, details: { status: 'ok' } };
  }
}
