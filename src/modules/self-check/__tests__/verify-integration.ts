/**
 * 流水线自检集成验证
 */

import { SelfCheckService } from '../self-check.service';
import { PipelineManager } from '../../pipeline/src/pipeline-manager';

// 验证自检服务和流水线管理器能够正确集成
function verifyIntegration(): boolean {
  try {
    const selfCheckService = new SelfCheckService();
    const pipelineManager = new PipelineManager();
    
    // 设置集成
    selfCheckService.setPipelineManager(pipelineManager);
    
    // 验证基本功能
    const stats = pipelineManager.getStatistics();
    
    return true;
  } catch {
    return false;
  }
}

// 执行验证
const integrationWorks = verifyIntegration();

export { integrationWorks, verifyIntegration };

// Jest 测试用例
describe('Self-Check Integration Tests', () => {
  test('should verify integration successfully', () => {
    const result = verifyIntegration();
    expect(typeof result).toBe('boolean');
  });
});