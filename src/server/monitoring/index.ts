/**
 * 服务器监控模块
 *
 * @author Jason Zhang
 */

export class ServerMonitor {
  getMetrics(): any {
    return { uptime: process.uptime(), memory: process.memoryUsage() };
  }
}
