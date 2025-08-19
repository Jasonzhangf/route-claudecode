/**
 * 模型映射服务
 *
 * 实现动态模型映射逻辑，基于两个静态表：
 * 1. 支持的Anthropic模型列表
 * 2. 路由分类规则（5个categories）
 */

/**
 * 支持的Anthropic模型列表（静态表1）
 */
export const SUPPORTED_ANTHROPIC_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307',
  'claude-sonnet-4-20250514',
  'claude-3-sonnet-20240229',
  'claude-3-opus-20240229',
] as const;

export type SupportedAnthropicModel = (typeof SUPPORTED_ANTHROPIC_MODELS)[number];

/**
 * 路由分类定义
 */
export interface RoutingCategory {
  name: string;
  description: string;
  models: SupportedAnthropicModel[];
  targetModel: string;
  priority: number;
}

/**
 * 路由分类规则（静态表2）
 */
export const ROUTING_CATEGORIES: Record<string, RoutingCategory> = {
  'high-performance': {
    name: '高性能',
    description: '最新最强的Claude模型映射到LM Studio最强模型',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'],
    targetModel: 'gpt-oss-20b-mlx',
    priority: 100,
  },
  balanced: {
    name: '平衡性能',
    description: '中等性能Claude模型映射到平衡模型',
    models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229'],
    targetModel: 'qwen3-30b-a3b-instruct-2507-mlx',
    priority: 80,
  },
  legacy: {
    name: '旧版模型',
    description: '较老的Claude模型映射到兼容模型',
    models: ['claude-3-opus-20240229'],
    targetModel: 'qwen3-4b-thinking-2507-mlx',
    priority: 60,
  },
};

/**
 * 模型映射结果
 */
export interface ModelMappingResult {
  isValid: boolean;
  inputModel: string;
  targetModel?: string;
  category?: string;
  error?: string;
}

/**
 * 模型映射服务
 */
export class ModelMappingService {
  private readonly categories: RoutingCategory[];
  private readonly supportedModels: Set<string>;

  constructor() {
    this.categories = Object.values(ROUTING_CATEGORIES).sort((a, b) => b.priority - a.priority);
    this.supportedModels = new Set(SUPPORTED_ANTHROPIC_MODELS);
  }

  /**
   * 输入校验：检查模型是否在支持列表中
   */
  validateInputModel(model: string): boolean {
    return this.supportedModels.has(model);
  }

  /**
   * 动态映射：根据分类规则生成目标模型
   */
  mapModel(inputModel: string): ModelMappingResult {
    // 1. 输入校验
    if (!this.validateInputModel(inputModel)) {
      return {
        isValid: false,
        inputModel,
        error: `Unsupported Anthropic model: ${inputModel}. Supported models: ${Array.from(this.supportedModels).join(', ')}`,
      };
    }

    // 2. 分类路由：按优先级查找匹配的分类
    for (const category of this.categories) {
      if (category.models.includes(inputModel as SupportedAnthropicModel)) {
        return {
          isValid: true,
          inputModel,
          targetModel: category.targetModel,
          category: category.name,
        };
      }
    }

    // 3. 零fallback策略 - 没有匹配的分类时抛出错误
    return {
      isValid: false,
      inputModel,
      error: `No routing category found for model: ${inputModel}. Model is supported but not assigned to any category.`,
    };
  }

  /**
   * 输出校验：检查目标模型是否在Provider可用列表中
   */
  validateOutputModel(targetModel: string, availableModels: string[]): boolean {
    return availableModels.includes(targetModel);
  }

  /**
   * 完整的映射流程：输入校验 -> 分类 -> 输出校验
   */
  performMapping(inputModel: string, availableModels: string[]): ModelMappingResult {
    // 步骤1: 映射模型
    const mappingResult = this.mapModel(inputModel);

    if (!mappingResult.isValid || !mappingResult.targetModel) {
      return mappingResult;
    }

    // 步骤2: 输出校验
    if (!this.validateOutputModel(mappingResult.targetModel, availableModels)) {
      return {
        isValid: false,
        inputModel,
        targetModel: mappingResult.targetModel,
        category: mappingResult.category,
        error: `Target model ${mappingResult.targetModel} not available in provider. Available models: ${availableModels.join(', ')}`,
      };
    }

    return mappingResult;
  }

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[] {
    return Array.from(this.supportedModels);
  }

  /**
   * 获取分类信息
   */
  getCategories(): RoutingCategory[] {
    return [...this.categories];
  }

  /**
   * 根据模型获取分类信息
   */
  getCategoryForModel(model: string): RoutingCategory | null {
    for (const category of this.categories) {
      if (category.models.includes(model as SupportedAnthropicModel)) {
        return category;
      }
    }
    // 零fallback策略 - 没有匹配时返回null
    return null;
  }
}

/**
 * 全局单例实例
 */
export const modelMappingService = new ModelMappingService();
