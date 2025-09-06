/**
 * API Module Tests
 */

import {
  createModule,
  startModule,
  stopModule,
  processWithModule,
  getModuleStatus
} from '../modules/module-management-api';
import { ModuleType } from '../modules/module-management-api';

describe('API Module', () => {
  it('should manage module lifecycle', async () => {
    // 创建模块
    const createResult = await createModule({
      type: ModuleType.TRANSFORMER,
      moduleType: 'test-transformer'
    });
    
    expect(createResult.id).toBeDefined();
    expect(createResult.type).toBe(ModuleType.TRANSFORMER);
    expect(createResult.status).toBe('created');
    
    // 启动模块
    const startResult = await startModule({ id: createResult.id });
    expect(startResult.status).toBe('started');
    
    // 检查模块状态
    const status = await getModuleStatus(createResult.id);
    expect(status.status).toBe('running');
    
    // 处理请求
    const processResult = await processWithModule({
      id: createResult.id,
      input: { test: 'data' }
    });
    expect(processResult.output).toEqual({ test: 'data' });
    
    // 停止模块
    const stopResult = await stopModule({ id: createResult.id });
    expect(stopResult.status).toBe('stopped');
  });
});