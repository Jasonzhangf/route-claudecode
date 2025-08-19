/**
 * ModelMappingService单元测试
 *
 * 测试动态模型映射的两个静态表和映射逻辑
 */

import {
  ModelMappingService,
  modelMappingService,
  SUPPORTED_ANTHROPIC_MODELS,
  ROUTING_CATEGORIES,
} from '../model-mapping-service';

describe('ModelMappingService', () => {
  const service = new ModelMappingService();
  const mockAvailableModels = ['gpt-oss-20b-mlx', 'qwen3-30b-a3b-instruct-2507-mlx', 'qwen3-4b-thinking-2507-mlx'];

  describe('输入校验（静态表1）', () => {
    it('应该接受支持的Anthropic模型', () => {
      expect(service.validateInputModel('claude-sonnet-4-20250514')).toBe(true);
      expect(service.validateInputModel('claude-3-5-sonnet-20241022')).toBe(true);
      expect(service.validateInputModel('claude-3-haiku-20240307')).toBe(true);
    });

    it('应该拒绝不支持的模型', () => {
      expect(service.validateInputModel('gpt-4')).toBe(false);
      expect(service.validateInputModel('invalid-model')).toBe(false);
      expect(service.validateInputModel('')).toBe(false);
    });

    it('应该返回完整的支持模型列表', () => {
      const supportedModels = service.getSupportedModels();
      expect(supportedModels).toContain('claude-sonnet-4-20250514');
      expect(supportedModels).toContain('claude-3-5-sonnet-20241022');
      expect(supportedModels.length).toBe(SUPPORTED_ANTHROPIC_MODELS.length);
    });
  });

  describe('分类路由（静态表2）', () => {
    it('应该将claude-sonnet-4-20250514映射到高性能分类', () => {
      const result = service.mapModel('claude-sonnet-4-20250514');

      expect(result.isValid).toBe(true);
      expect(result.targetModel).toBe('gpt-oss-20b-mlx');
      expect(result.category).toBe('高性能');
    });

    it('应该将claude-3-haiku-20240307映射到平衡性能分类', () => {
      const result = service.mapModel('claude-3-haiku-20240307');

      expect(result.isValid).toBe(true);
      expect(result.targetModel).toBe('qwen3-30b-a3b-instruct-2507-mlx');
      expect(result.category).toBe('平衡性能');
    });

    it('应该将claude-3-opus-20240229映射到旧版模型分类', () => {
      const result = service.mapModel('claude-3-opus-20240229');

      expect(result.isValid).toBe(true);
      expect(result.targetModel).toBe('qwen3-4b-thinking-2507-mlx');
      expect(result.category).toBe('旧版模型');
    });

    it('应该拒绝无效模型', () => {
      const result = service.mapModel('invalid-model');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported Anthropic model');
    });
  });

  describe('输出校验', () => {
    it('应该验证目标模型在可用列表中', () => {
      expect(service.validateOutputModel('gpt-oss-20b-mlx', mockAvailableModels)).toBe(true);
      expect(service.validateOutputModel('qwen3-30b-a3b-instruct-2507-mlx', mockAvailableModels)).toBe(true);
    });

    it('应该拒绝不可用的目标模型', () => {
      expect(service.validateOutputModel('unavailable-model', mockAvailableModels)).toBe(false);
    });
  });

  describe('完整映射流程', () => {
    it('应该成功完成端到端映射：claude-sonnet-4 -> gpt-oss-20b-mlx', () => {
      const result = service.performMapping('claude-sonnet-4-20250514', mockAvailableModels);

      expect(result.isValid).toBe(true);
      expect(result.inputModel).toBe('claude-sonnet-4-20250514');
      expect(result.targetModel).toBe('gpt-oss-20b-mlx');
      expect(result.category).toBe('高性能');
      expect(result.error).toBeUndefined();
    });

    it('应该失败当目标模型不可用时', () => {
      const limitedAvailableModels = ['other-model'];
      const result = service.performMapping('claude-sonnet-4-20250514', limitedAvailableModels);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Target model gpt-oss-20b-mlx not available');
    });

    it('应该失败当输入模型无效时', () => {
      const result = service.performMapping('invalid-model', mockAvailableModels);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported Anthropic model');
    });
  });

  describe('分类信息查询', () => {
    it('应该返回所有分类信息', () => {
      const categories = service.getCategories();

      expect(categories).toHaveLength(3); // 修正期望值，不再包含fallback分类
      expect(categories.some(cat => cat.name === '高性能')).toBe(true);
      expect(categories.some(cat => cat.name === '平衡性能')).toBe(true);
      expect(categories.some(cat => cat.name === '旧版模型')).toBe(true);
    });

    it('应该根据模型返回正确分类', () => {
      const category = service.getCategoryForModel('claude-sonnet-4-20250514');

      expect(category).not.toBeNull();
      expect(category!.name).toBe('高性能');
      expect(category!.priority).toBe(100);
    });

    it('应该对未分类模型返回null（零fallback策略）', () => {
      const category = service.getCategoryForModel('unknown-model');

      expect(category).toBeNull();
    });
  });

  describe('全局单例', () => {
    it('应该提供全局单例实例', () => {
      expect(modelMappingService).toBeDefined();
      expect(modelMappingService).toBeInstanceOf(ModelMappingService);
    });

    it('全局单例应该与新实例行为一致', () => {
      const localResult = service.mapModel('claude-sonnet-4-20250514');
      const globalResult = modelMappingService.mapModel('claude-sonnet-4-20250514');

      expect(localResult).toEqual(globalResult);
    });
  });
});
