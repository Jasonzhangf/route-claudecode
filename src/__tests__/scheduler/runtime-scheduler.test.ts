/**
 * 运行时调度器测试
 * 
 * RCC v4.0 架构重构核心组件测试
 * 
 * @author RCC v4.0 Architecture Team
 */

import { RuntimeScheduler } from '../../pipeline/runtime-scheduler';
import { 
  DynamicSchedulerError, 
  LoadBalanceStrategy 
} from '../../interfaces/scheduler/dynamic-scheduler';

// 创建一个简单的测试流水线实现
class TestPipeline {
  pipelineId: string;
  virtualModel: string;
  provider: string;
  targetModel: string;
  apiKey: string;
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  lastHandshakeTime: Date;
  
  constructor(id: string, model: string) {
    this.pipelineId = id;
    this.virtualModel = model;
    this.provider = 'test-provider';
    this.targetModel = 'test-target-model';
    this.apiKey = 'test-api-key';
    this.status = 'runtime';
    this.lastHandshakeTime = new Date();
  }
  
  async execute(request: any): Promise<any> {
    return { 
      id: this.pipelineId,
      data: 'test-response',
      requestReceived: request
    };
  }
  
  async handshake(): Promise<void> {
    this.lastHandshakeTime = new Date();
  }
  
  async healthCheck(): Promise<boolean> {
    return true;
  }
  
  getStatus(): any {
    return { status: this.status };
  }
  
  async stop(): Promise<void> {
    this.status = 'stopped';
  }
}

describe('RuntimeScheduler', () => {
  let scheduler: RuntimeScheduler;

  beforeEach(() => {
    scheduler = new RuntimeScheduler({
      strategy: LoadBalanceStrategy.ROUND_ROBIN,
      maxErrorCount: 3,
      blacklistDuration: 300000
    });
  });

  afterEach(async () => {
    await scheduler.cleanup();
  });

  describe('constructor and initialization', () => {
    it('should create a runtime scheduler with default config', () => {
      const defaultScheduler = new RuntimeScheduler();
      expect(defaultScheduler).toBeDefined();
    });

    it('should create a runtime scheduler with custom config', () => {
      const customScheduler = new RuntimeScheduler({
        strategy: LoadBalanceStrategy.RANDOM,
        maxErrorCount: 5,
        blacklistDuration: 600000
      });
      
      expect(customScheduler).toBeDefined();
    });
  });

  describe('registerPipeline', () => {
    it('should register a pipeline successfully', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      
      expect(() => {
        scheduler.registerPipeline(testPipeline as any, 'test-model');
      }).not.toThrow();
    });

    it('should register a pipeline successfully', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      
      expect(() => {
        scheduler.registerPipeline(testPipeline as any, 'test-model');
      }).not.toThrow();
    });
  });

  describe('scheduleRequest', () => {
    it('should schedule a request successfully', async () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      const request = {
        requestId: 'test-request-1',
        model: 'test-model',
        request: { messages: [{ role: 'user', content: 'Hello' }] },
        priority: 'normal' as const
      };

      const response = await scheduler.scheduleRequest(request);
      
      expect(response.success).toBe(true);
      expect(response.requestId).toBe(request.requestId);
      expect(response.pipelineId).toBe('test-pipeline-1');
      expect(response.response).toBeDefined();
    });

    it('should schedule a request successfully', async () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      const request = {
        requestId: 'test-request-1',
        model: 'test-model',
        request: { messages: [{ role: 'user', content: 'Hello' }]},
        priority: 'normal' as const
      };

      const response = await scheduler.scheduleRequest(request);
      
      expect(response.success).toBe(true);
      expect(response.requestId).toBe(request.requestId);
      expect(response.pipelineId).toBe('test-pipeline-1');
      expect(response.response).toBeDefined();
    });
  });

  describe('getSchedulerStats', () => {
    it('should return scheduler stats', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      const stats = scheduler.getSchedulerStats();
      
      expect(stats.totalPipelines).toBe(1);
      expect(stats.categoriesCount).toBe(1);
      expect(stats.strategy).toBe(LoadBalanceStrategy.ROUND_ROBIN);
    });

    it('should return scheduler stats', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      const stats = scheduler.getSchedulerStats();
      
      expect(stats.totalPipelines).toBe(1);
      expect(stats.categoriesCount).toBe(1);
      expect(stats.strategy).toBe(LoadBalanceStrategy.ROUND_ROBIN);
    });
  });

  describe('getPipelineHealth', () => {
    it('should return pipeline health status', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      const health = scheduler.getPipelineHealth('test-pipeline-1');
      
      expect(health).not.toBeNull();
      expect(health?.pipelineId).toBe('test-pipeline-1');
      expect(health?.isAvailable).toBe(true);
      expect(health?.healthStatus).toBe('healthy');
    });

    it('should return null for non-existent pipeline', () => {
      const health = scheduler.getPipelineHealth('non-existent-pipeline');
      
      expect(health).toBeNull();
    });

    it('should return pipeline health status', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      const health = scheduler.getPipelineHealth('test-pipeline-1');
      
      expect(health).not.toBeNull();
      expect(health?.pipelineId).toBe('test-pipeline-1');
      expect(health?.isAvailable).toBe(true);
      expect(health?.healthStatus).toBe('healthy');
    });
  });

  describe('getCategoryPipelineHealth', () => {
    it('should return category pipeline health statuses', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      const healthStatuses = scheduler.getCategoryPipelineHealth('test-model');
      
      expect(healthStatuses).toHaveLength(1);
      expect(healthStatuses[0].pipelineId).toBe('test-pipeline-1');
      expect(healthStatuses[0].healthStatus).toBe('healthy');
    });

    it('should return empty array for non-existent category', () => {
      const healthStatuses = scheduler.getCategoryPipelineHealth('non-existent-category');
      
      expect(healthStatuses).toHaveLength(0);
    });

    it('should return category pipeline health statuses', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      const healthStatuses = scheduler.getCategoryPipelineHealth('test-model');
      
      expect(healthStatuses).toHaveLength(1);
      expect(healthStatuses[0].pipelineId).toBe('test-pipeline-1');
      expect(healthStatuses[0].healthStatus).toBe('healthy');
    });
  });

  describe('unregisterPipeline', () => {
    it('should unregister a pipeline successfully', () => {
      expect(() => {
        scheduler.unregisterPipeline('test-pipeline-1');
      }).not.toThrow();
    });

    it('should unregister a pipeline successfully', () => {
      const testPipeline = new TestPipeline('test-pipeline-1', 'test-model');
      scheduler.registerPipeline(testPipeline as any, 'test-model');
      
      expect(() => {
        scheduler.unregisterPipeline('test-pipeline-1');
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup scheduler resources successfully', async () => {
      await expect(scheduler.cleanup()).resolves.not.toThrow();
    });
  });
});