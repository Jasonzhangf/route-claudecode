# CLI扩展命令模块

## 模块概述

CLI扩展命令模块提供高级CLI功能，包括Provider自动更新、模型发现、配置优化等智能化功能，提升用户体验和系统维护效率。

## 目录结构

```
src/cli-extensions/
├── README.md                        # CLI扩展模块文档
├── index.ts                         # CLI扩展入口
├── provider-updater/                # Provider更新器
│   ├── README.md                    # Provider更新器文档
│   ├── provider-updater.ts          # 主更新器
│   ├── model-discoverer.ts          # 模型发现器
│   ├── token-tester.ts              # Token测试器
│   ├── blacklist-manager.ts         # 黑名单管理器
│   ├── history-manager.ts           # 历史记录管理器
│   └── whitelist-manager.ts         # 白名单管理器
├── config-optimizer/                # 配置优化器
│   ├── config-optimizer.ts          # 配置优化器
│   ├── performance-analyzer.ts      # 性能分析器
│   └── recommendation-engine.ts     # 推荐引擎
├── model-manager/                   # 模型管理器
│   ├── model-manager.ts             # 模型管理器
│   ├── context-analyzer.ts          # 上下文分析器
│   └── capability-detector.ts       # 能力检测器
└── types/                           # CLI扩展类型
    ├── provider-types.ts            # Provider相关类型
    ├── model-types.ts               # 模型相关类型
    └── cli-types.ts                 # CLI相关类型
```

## 核心功能

### 1. Provider自动更新 (`rcc provider update`)

#### 功能描述
自动发现和更新Provider配置，包括模型列表、能力检测、Token限制测试等。

#### 命令格式
```bash
rcc provider update [options]

Options:
  --provider <name>     指定要更新的Provider (可选，默认更新所有)
  --force              强制更新，忽略历史记录
  --dry-run            预览模式，不实际更新配置
  --verbose            详细输出模式
  --timeout <seconds>  API调用超时时间 (默认30秒)
```

#### 实现架构
```typescript
// src/cli-extensions/provider-updater/provider-updater.ts
export class ProviderUpdater {
  private modelDiscoverer: ModelDiscoverer;
  private tokenTester: TokenTester;
  private blacklistManager: BlacklistManager;
  private historyManager: HistoryManager;
  private whitelistManager: WhitelistManager;

  constructor() {
    this.modelDiscoverer = new ModelDiscoverer();
    this.tokenTester = new TokenTester();
    this.blacklistManager = new BlacklistManager();
    this.historyManager = new HistoryManager();
    this.whitelistManager = new WhitelistManager();
  }

  async updateProviders(options: UpdateOptions): Promise<UpdateResult> {
    const providers = await this.loadProviders(options.provider);
    const results: ProviderUpdateResult[] = [];

    for (const provider of providers) {
      try {
        const result = await this.updateSingleProvider(provider, options);
        results.push(result);
      } catch (error) {
        results.push({
          provider: provider.name,
          success: false,
          error: error.message,
          skipped: false
        });
      }
    }

    return {
      totalProviders: providers.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
      results
    };
  }

  private async updateSingleProvider(
    provider: ProviderConfig, 
    options: UpdateOptions
  ): Promise<ProviderUpdateResult> {
    // 检查历史记录
    if (!options.force && await this.historyManager.shouldSkip(provider.name)) {
      return {
        provider: provider.name,
        success: true,
        skipped: true,
        reason: 'Recently updated or failed'
      };
    }

    // 发现可用模型
    const discoveredModels = await this.modelDiscoverer.discoverModels(provider);
    
    // 过滤黑名单模型
    const filteredModels = await this.blacklistManager.filterModels(
      provider.name, 
      discoveredModels
    );

    // 测试Token限制
    const testedModels = await this.tokenTester.testModels(
      provider, 
      filteredModels
    );

    // 更新长上下文模型配置
    const longContextModel = await this.selectBestLongContextModel(
      provider.name,
      testedModels
    );

    // 生成更新后的配置
    const updatedProvider = {
      ...provider,
      models: testedModels.map(m => m.name),
      modelCapabilities: testedModels.reduce((acc, model) => {
        acc[model.name] = {
          maxTokens: model.maxTokens,
          supportsTools: model.supportsTools,
          supportsStreaming: model.supportsStreaming,
          contextLength: model.contextLength,
          isLongContext: model.isLongContext
        };
        return acc;
      }, {} as Record<string, ModelCapabilities>),
      longContextModel: longContextModel?.name,
      lastUpdated: new Date().toISOString()
    };

    // 保存配置（如果不是dry-run模式）
    if (!options.dryRun) {
      await this.saveProviderConfig(updatedProvider);
      await this.historyManager.recordUpdate(provider.name, true);
    }

    return {
      provider: provider.name,
      success: true,
      skipped: false,
      modelsFound: discoveredModels.length,
      modelsFiltered: filteredModels.length,
      modelsTested: testedModels.length,
      longContextModel: longContextModel?.name,
      changes: this.calculateChanges(provider, updatedProvider)
    };
  }
}
```

### 2. 模型发现器
```typescript
// src/cli-extensions/provider-updater/model-discoverer.ts
export class ModelDiscoverer {
  async discoverModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
    switch (provider.protocol) {
      case 'openai':
        return await this.discoverOpenAIModels(provider);
      case 'anthropic':
        return await this.discoverAnthropicModels(provider);
      case 'gemini':
        return await this.discoverGeminiModels(provider);
      default:
        throw new Error(`Unsupported provider protocol: ${provider.protocol}`);
    }
  }

  private async discoverOpenAIModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl
    });

    try {
      const response = await client.models.list();
      
      return response.data
        .filter(model => this.isValidChatModel(model))
        .map(model => ({
          name: model.id,
          provider: provider.name,
          protocol: 'openai',
          capabilities: this.inferOpenAICapabilities(model),
          discovered: true,
          lastTested: null
        }));
    } catch (error) {
      throw new Error(`Failed to discover OpenAI models: ${error.message}`);
    }
  }

  private async discoverAnthropicModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
    // Anthropic没有公开的模型列表API，使用已知模型列表
    const knownModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];

    return knownModels.map(modelName => ({
      name: modelName,
      provider: provider.name,
      protocol: 'anthropic',
      capabilities: this.inferAnthropicCapabilities(modelName),
      discovered: false, // 基于已知列表，非动态发现
      lastTested: null
    }));
  }

  private async discoverGeminiModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
    const genAI = new GoogleGenerativeAI(provider.apiKey);
    
    try {
      // Gemini模型发现逻辑
      const knownModels = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
      ];

      return knownModels.map(modelName => ({
        name: modelName,
        provider: provider.name,
        protocol: 'gemini',
        capabilities: this.inferGeminiCapabilities(modelName),
        discovered: false,
        lastTested: null
      }));
    } catch (error) {
      throw new Error(`Failed to discover Gemini models: ${error.message}`);
    }
  }

  private isValidChatModel(model: any): boolean {
    // 过滤掉非聊天模型
    const chatModelPatterns = [
      /gpt-/,
      /claude-/,
      /gemini-/,
      /chat/i,
      /instruct/i
    ];

    const excludePatterns = [
      /embedding/i,
      /whisper/i,
      /dall-e/i,
      /tts/i,
      /moderation/i
    ];

    const modelId = model.id.toLowerCase();
    
    return chatModelPatterns.some(pattern => pattern.test(modelId)) &&
           !excludePatterns.some(pattern => pattern.test(modelId));
  }

  private inferOpenAICapabilities(model: any): ModelCapabilities {
    const modelId = model.id.toLowerCase();
    
    return {
      maxTokens: this.inferMaxTokens(modelId),
      supportsTools: this.inferToolSupport(modelId),
      supportsStreaming: true, // 大多数OpenAI模型支持流式
      contextLength: this.inferContextLength(modelId),
      isLongContext: this.inferLongContext(modelId),
      costPerToken: this.inferCostPerToken(modelId)
    };
  }

  private inferMaxTokens(modelId: string): number {
    // 基于模型名称推断最大Token数
    if (modelId.includes('gpt-4')) {
      if (modelId.includes('32k')) return 32768;
      if (modelId.includes('turbo')) return 4096;
      return 8192;
    }
    
    if (modelId.includes('gpt-3.5')) {
      if (modelId.includes('16k')) return 16384;
      return 4096;
    }
    
    if (modelId.includes('claude-3')) {
      return 4096; // Claude 3默认输出限制
    }
    
    if (modelId.includes('gemini')) {
      return 8192; // Gemini默认输出限制
    }
    
    return 2048; // 默认值
  }

  private inferContextLength(modelId: string): number {
    // 推断上下文长度
    if (modelId.includes('gpt-4')) {
      if (modelId.includes('32k')) return 32768;
      if (modelId.includes('turbo')) return 128000;
      return 8192;
    }
    
    if (modelId.includes('claude-3')) {
      return 200000; // Claude 3支持200K上下文
    }
    
    if (modelId.includes('gemini-2.5')) {
      return 2000000; // Gemini 2.5支持2M上下文
    }
    
    if (modelId.includes('gemini-1.5')) {
      return 1000000; // Gemini 1.5支持1M上下文
    }
    
    return 4096; // 默认值
  }

  private inferLongContext(modelId: string): boolean {
    const longContextThreshold = 100000; // 10万Token以上认为是长上下文
    return this.inferContextLength(modelId) >= longContextThreshold;
  }
}
```

### 3. Token测试器
```typescript
// src/cli-extensions/provider-updater/token-tester.ts
export class TokenTester {
  private readonly TEST_TOKEN_SIZES = [512, 1024, 2048, 4096, 8192, 16384, 32768];
  private readonly TEST_TIMEOUT = 30000; // 30秒超时

  async testModels(
    provider: ProviderConfig, 
    models: DiscoveredModel[]
  ): Promise<TestedModel[]> {
    const results: TestedModel[] = [];

    for (const model of models) {
      try {
        const testResult = await this.testSingleModel(provider, model);
        results.push(testResult);
      } catch (error) {
        // 测试失败的模型记录到黑名单
        await this.recordFailedModel(provider.name, model.name, error.message);
        
        results.push({
          ...model,
          maxTokens: 0,
          testPassed: false,
          testError: error.message,
          lastTested: new Date().toISOString()
        });
      }
    }

    return results.filter(model => model.testPassed);
  }

  private async testSingleModel(
    provider: ProviderConfig, 
    model: DiscoveredModel
  ): Promise<TestedModel> {
    // 使用二分查找确定最大Token数
    let maxValidTokens = 0;
    
    for (const tokenSize of this.TEST_TOKEN_SIZES) {
      try {
        const success = await this.testTokenSize(provider, model, tokenSize);
        if (success) {
          maxValidTokens = tokenSize;
        } else {
          break; // 找到上限，停止测试
        }
      } catch (error) {
        // 如果是速率限制错误，等待后重试
        if (this.isRateLimitError(error)) {
          await this.waitForRateLimit();
          continue;
        }
        throw error;
      }
    }

    if (maxValidTokens === 0) {
      throw new Error('Model failed basic token test');
    }

    // 测试其他能力
    const capabilities = await this.testModelCapabilities(provider, model);

    return {
      ...model,
      maxTokens: maxValidTokens,
      testPassed: true,
      testError: null,
      lastTested: new Date().toISOString(),
      ...capabilities
    };
  }

  private async testTokenSize(
    provider: ProviderConfig,
    model: DiscoveredModel,
    tokenSize: number
  ): Promise<boolean> {
    const testMessage = this.generateTestMessage(tokenSize);
    
    try {
      const response = await this.makeTestRequest(provider, model, {
        max_tokens: tokenSize,
        messages: [{ role: 'user', content: testMessage }]
      });

      return response && response.content && response.content.length > 0;
    } catch (error) {
      if (this.isTokenLimitError(error)) {
        return false; // Token限制错误，说明超出了模型能力
      }
      throw error; // 其他错误重新抛出
    }
  }

  private async testModelCapabilities(
    provider: ProviderConfig,
    model: DiscoveredModel
  ): Promise<Partial<TestedModel>> {
    const capabilities: Partial<TestedModel> = {};

    // 测试工具调用支持
    try {
      capabilities.supportsTools = await this.testToolSupport(provider, model);
    } catch {
      capabilities.supportsTools = false;
    }

    // 测试流式支持
    try {
      capabilities.supportsStreaming = await this.testStreamingSupport(provider, model);
    } catch {
      capabilities.supportsStreaming = false;
    }

    return capabilities;
  }

  private async testToolSupport(
    provider: ProviderConfig,
    model: DiscoveredModel
  ): Promise<boolean> {
    const testTool = {
      name: 'test_function',
      description: 'A test function',
      input_schema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      }
    };

    try {
      const response = await this.makeTestRequest(provider, model, {
        max_tokens: 100,
        messages: [{ 
          role: 'user', 
          content: 'Please call the test_function with message "hello"' 
        }],
        tools: [testTool]
      });

      return response && response.tool_calls && response.tool_calls.length > 0;
    } catch {
      return false;
    }
  }

  private generateTestMessage(targetTokens: number): string {
    // 生成指定Token数量的测试消息
    const baseMessage = 'Please respond with a simple acknowledgment. ';
    const repeatCount = Math.max(1, Math.floor(targetTokens / 10)); // 粗略估算
    
    return baseMessage.repeat(repeatCount);
  }

  private isRateLimitError(error: any): boolean {
    return error.status === 429 || 
           error.message?.includes('rate limit') ||
           error.message?.includes('quota exceeded');
  }

  private isTokenLimitError(error: any): boolean {
    return error.status === 400 &&
           (error.message?.includes('max_tokens') ||
            error.message?.includes('token limit') ||
            error.message?.includes('context length'));
  }

  private async waitForRateLimit(): Promise<void> {
    // 等待速率限制恢复
    await new Promise(resolve => setTimeout(resolve, 60000)); // 等待1分钟
  }
}
```

### 4. 黑名单管理器
```typescript
// src/cli-extensions/provider-updater/blacklist-manager.ts
export class BlacklistManager {
  private blacklistPath: string;
  private blacklist: ProviderBlacklist;

  constructor() {
    this.blacklistPath = path.join(
      os.homedir(), 
      '.route-claudecode', 
      'config', 
      'blacklist.json'
    );
    this.loadBlacklist();
  }

  async filterModels(
    providerName: string, 
    models: DiscoveredModel[]
  ): Promise<DiscoveredModel[]> {
    const providerBlacklist = this.blacklist.providers[providerName] || {};
    const globalBlacklist = this.blacklist.global || {};

    return models.filter(model => {
      // 检查全局黑名单
      if (globalBlacklist.models?.includes(model.name)) {
        return false;
      }

      // 检查Provider特定黑名单
      if (providerBlacklist.models?.includes(model.name)) {
        return false;
      }

      // 检查模式匹配黑名单
      if (this.matchesBlacklistPattern(model.name, globalBlacklist.patterns)) {
        return false;
      }

      if (this.matchesBlacklistPattern(model.name, providerBlacklist.patterns)) {
        return false;
      }

      return true;
    });
  }

  async addToBlacklist(
    providerName: string, 
    modelName: string, 
    reason: string
  ): Promise<void> {
    if (!this.blacklist.providers[providerName]) {
      this.blacklist.providers[providerName] = { models: [], patterns: [] };
    }

    const providerBlacklist = this.blacklist.providers[providerName];
    
    if (!providerBlacklist.models.includes(modelName)) {
      providerBlacklist.models.push(modelName);
      
      // 记录黑名单原因
      if (!providerBlacklist.reasons) {
        providerBlacklist.reasons = {};
      }
      providerBlacklist.reasons[modelName] = {
        reason,
        addedAt: new Date().toISOString(),
        failureCount: (providerBlacklist.reasons[modelName]?.failureCount || 0) + 1
      };

      await this.saveBlacklist();
    }
  }

  async removeFromBlacklist(providerName: string, modelName: string): Promise<void> {
    const providerBlacklist = this.blacklist.providers[providerName];
    if (providerBlacklist) {
      providerBlacklist.models = providerBlacklist.models.filter(m => m !== modelName);
      
      if (providerBlacklist.reasons) {
        delete providerBlacklist.reasons[modelName];
      }

      await this.saveBlacklist();
    }
  }

  getBlacklistedModels(providerName?: string): BlacklistEntry[] {
    if (providerName) {
      const providerBlacklist = this.blacklist.providers[providerName];
      if (!providerBlacklist) return [];

      return providerBlacklist.models.map(model => ({
        provider: providerName,
        model,
        reason: providerBlacklist.reasons?.[model]?.reason || 'Unknown',
        addedAt: providerBlacklist.reasons?.[model]?.addedAt || 'Unknown',
        failureCount: providerBlacklist.reasons?.[model]?.failureCount || 1
      }));
    }

    // 返回所有Provider的黑名单
    const allEntries: BlacklistEntry[] = [];
    
    for (const [provider, blacklist] of Object.entries(this.blacklist.providers)) {
      const entries = blacklist.models.map(model => ({
        provider,
        model,
        reason: blacklist.reasons?.[model]?.reason || 'Unknown',
        addedAt: blacklist.reasons?.[model]?.addedAt || 'Unknown',
        failureCount: blacklist.reasons?.[model]?.failureCount || 1
      }));
      allEntries.push(...entries);
    }

    return allEntries;
  }

  private loadBlacklist(): void {
    try {
      if (fs.existsSync(this.blacklistPath)) {
        const content = fs.readFileSync(this.blacklistPath, 'utf-8');
        this.blacklist = JSON.parse(content);
      } else {
        this.blacklist = this.createDefaultBlacklist();
      }
    } catch (error) {
      console.warn(`Failed to load blacklist: ${error.message}`);
      this.blacklist = this.createDefaultBlacklist();
    }
  }

  private createDefaultBlacklist(): ProviderBlacklist {
    return {
      global: {
        models: [
          'text-embedding-ada-002',
          'whisper-1',
          'dall-e-2',
          'dall-e-3',
          'tts-1',
          'tts-1-hd'
        ],
        patterns: [
          'embedding',
          'whisper',
          'dall-e',
          'tts',
          'moderation'
        ]
      },
      providers: {}
    };
  }

  private matchesBlacklistPattern(modelName: string, patterns?: string[]): boolean {
    if (!patterns) return false;
    
    return patterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(modelName);
      } catch {
        // 如果不是有效的正则表达式，使用简单的字符串匹配
        return modelName.toLowerCase().includes(pattern.toLowerCase());
      }
    });
  }

  private async saveBlacklist(): Promise<void> {
    try {
      const dir = path.dirname(this.blacklistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.blacklistPath, 
        JSON.stringify(this.blacklist, null, 2)
      );
    } catch (error) {
      throw new Error(`Failed to save blacklist: ${error.message}`);
    }
  }
}
```

### 5. 白名单管理器
```typescript
// src/cli-extensions/provider-updater/whitelist-manager.ts
export class WhitelistManager {
  private whitelistPath: string;
  private whitelist: LongContextWhitelist;

  constructor() {
    this.whitelistPath = path.join(
      os.homedir(),
      '.route-claudecode',
      'config',
      'long-context-whitelist.json'
    );
    this.loadWhitelist();
  }

  async selectBestLongContextModel(
    providerName: string,
    availableModels: TestedModel[]
  ): Promise<TestedModel | null> {
    // 过滤长上下文模型
    const longContextModels = availableModels.filter(model => 
      model.isLongContext && model.contextLength >= 100000
    );

    if (longContextModels.length === 0) {
      return null;
    }

    // 获取白名单优先级
    const whitelist = this.whitelist.providers[providerName] || this.whitelist.global;
    
    // 按白名单优先级排序
    const sortedModels = longContextModels.sort((a, b) => {
      const aPriority = this.getModelPriority(a.name, whitelist);
      const bPriority = this.getModelPriority(b.name, whitelist);
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // 高优先级在前
      }
      
      // 如果优先级相同，按上下文长度排序
      return b.contextLength - a.contextLength;
    });

    return sortedModels[0];
  }

  private getModelPriority(modelName: string, whitelist: ModelPriorityList): number {
    // 检查精确匹配
    const exactMatch = whitelist.models.find(m => m.name === modelName);
    if (exactMatch) {
      return exactMatch.priority;
    }

    // 检查模式匹配
    for (const pattern of whitelist.patterns) {
      try {
        const regex = new RegExp(pattern.pattern, 'i');
        if (regex.test(modelName)) {
          return pattern.priority;
        }
      } catch {
        // 简单字符串匹配
        if (modelName.toLowerCase().includes(pattern.pattern.toLowerCase())) {
          return pattern.priority;
        }
      }
    }

    return 0; // 默认优先级
  }

  private loadWhitelist(): void {
    try {
      if (fs.existsSync(this.whitelistPath)) {
        const content = fs.readFileSync(this.whitelistPath, 'utf-8');
        this.whitelist = JSON.parse(content);
      } else {
        this.whitelist = this.createDefaultWhitelist();
        this.saveWhitelist();
      }
    } catch (error) {
      console.warn(`Failed to load whitelist: ${error.message}`);
      this.whitelist = this.createDefaultWhitelist();
    }
  }

  private createDefaultWhitelist(): LongContextWhitelist {
    return {
      global: {
        models: [
          { name: 'claude-3-5-sonnet-20241022', priority: 100 },
          { name: 'gpt-4-turbo', priority: 90 },
          { name: 'gemini-2.5-pro', priority: 85 },
          { name: 'claude-3-opus-20240229', priority: 80 },
          { name: 'gpt-4-32k', priority: 70 }
        ],
        patterns: [
          { pattern: 'claude-3-5', priority: 95 },
          { pattern: 'gpt-4.*turbo', priority: 85 },
          { pattern: 'gemini-2\\.5', priority: 80 },
          { pattern: 'claude-3-opus', priority: 75 }
        ]
      },
      providers: {
        openai: {
          models: [
            { name: 'gpt-4-turbo', priority: 100 },
            { name: 'gpt-4-32k', priority: 80 }
          ],
          patterns: [
            { pattern: 'gpt-4.*turbo', priority: 95 }
          ]
        },
        anthropic: {
          models: [
            { name: 'claude-3-5-sonnet-20241022', priority: 100 },
            { name: 'claude-3-opus-20240229', priority: 90 }
          ],
          patterns: [
            { pattern: 'claude-3-5', priority: 95 }
          ]
        },
        gemini: {
          models: [
            { name: 'gemini-2.5-pro', priority: 100 },
            { name: 'gemini-1.5-pro', priority: 80 }
          ],
          patterns: [
            { pattern: 'gemini-2\\.5', priority: 95 }
          ]
        }
      }
    };
  }

  private async saveWhitelist(): Promise<void> {
    try {
      const dir = path.dirname(this.whitelistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.whitelistPath,
        JSON.stringify(this.whitelist, null, 2)
      );
    } catch (error) {
      throw new Error(`Failed to save whitelist: ${error.message}`);
    }
  }
}
```

## CLI命令集成

### 扩展CLI命令
```typescript
// src/cli-extensions/index.ts
import { Command } from 'commander';
import { ProviderUpdater } from './provider-updater/provider-updater';

export function registerExtensionCommands(program: Command): void {
  // Server模式命令
  program
    .command('start')
    .description('启动RCC路由服务器')
    .option('-p, --port <port>', '服务器端口', '3456')
    .option('-c, --config <path>', '配置文件路径')
    .option('-d, --debug', '启用调试模式')
    .action(async (options) => {
      const cliServer = new CLIServer();
      await cliServer.start({
        port: parseInt(options.port),
        configPath: options.config,
        debug: options.debug
      });
    });

  // Client模式命令
  program
    .command('code')
    .description('启动Claude Code并自动配置RCC代理')
    .option('-p, --port <port>', 'RCC服务器端口', '3456')
    .option('-a, --auto-start', '自动启动RCC服务器')
    .option('-c, --config <path>', '配置文件路径')
    .action(async (options) => {
      const cliClient = new CLIClient();
      await cliClient.startClaudeCode({
        port: parseInt(options.port),
        autoStart: options.autoStart,
        configPath: options.config
      });
    });

  // 管理命令
  program
    .command('stop')
    .description('停止RCC服务器')
    .option('-p, --port <port>', '服务器端口', '3456')
    .action(async (options) => {
      // 停止服务器逻辑
    });

  program
    .command('status')
    .description('查看RCC服务器状态')
    .option('-p, --port <port>', '服务器端口', '3456')
    .action(async (options) => {
      // 状态查询逻辑
    });

  // Provider更新命令
  const providerCommand = program
    .command('provider')
    .description('Provider管理命令');

  providerCommand
    .command('update')
    .description('自动更新Provider配置和模型列表')
    .option('--provider <name>', '指定要更新的Provider')
    .option('--force', '强制更新，忽略历史记录')
    .option('--dry-run', '预览模式，不实际更新配置')
    .option('--verbose', '详细输出模式')
    .option('--timeout <seconds>', 'API调用超时时间', '30')
    .action(async (options) => {
      const updater = new ProviderUpdater();
      
      try {
        const result = await updater.updateProviders({
          provider: options.provider,
          force: options.force,
          dryRun: options.dryRun,
          verbose: options.verbose,
          timeout: parseInt(options.timeout) * 1000
        });

        console.log('🎉 Provider更新完成!');
        console.log(`✅ 成功: ${result.successful}`);
        console.log(`❌ 失败: ${result.failed}`);
        console.log(`⏭️  跳过: ${result.skipped}`);

        if (options.verbose) {
          console.log('\n📊 详细结果:');
          result.results.forEach(r => {
            console.log(`  ${r.provider}: ${r.success ? '✅' : '❌'} ${r.reason || ''}`);
          });
        }
      } catch (error) {
        console.error('❌ Provider更新失败:', error.message);
        process.exit(1);
      }
    });

  // 黑名单管理命令
  providerCommand
    .command('blacklist')
    .description('管理模型黑名单')
    .option('--list', '列出黑名单')
    .option('--add <provider:model>', '添加到黑名单')
    .option('--remove <provider:model>', '从黑名单移除')
    .option('--reason <reason>', '添加到黑名单的原因')
    .action(async (options) => {
      // 黑名单管理逻辑
    });

  // 配置优化命令
  program
    .command('optimize')
    .description('优化配置和性能')
    .option('--analyze', '分析当前配置性能')
    .option('--recommend', '生成优化建议')
    .option('--apply', '应用优化建议')
    .action(async (options) => {
      // 配置优化逻辑
    });
}
```

## 类型定义

```typescript
// src/cli-extensions/types/provider-types.ts
export interface UpdateOptions {
  provider?: string;
  force: boolean;
  dryRun: boolean;
  verbose: boolean;
  timeout: number;
}

export interface UpdateResult {
  totalProviders: number;
  successful: number;
  failed: number;
  skipped: number;
  results: ProviderUpdateResult[];
}

export interface ProviderUpdateResult {
  provider: string;
  success: boolean;
  skipped: boolean;
  error?: string;
  reason?: string;
  modelsFound?: number;
  modelsFiltered?: number;
  modelsTested?: number;
  longContextModel?: string;
  changes?: ConfigChange[];
}

export interface DiscoveredModel {
  name: string;
  provider: string;
  protocol: string;
  capabilities: ModelCapabilities;
  discovered: boolean;
  lastTested: string | null;
}

export interface TestedModel extends DiscoveredModel {
  maxTokens: number;
  testPassed: boolean;
  testError: string | null;
  lastTested: string;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  contextLength?: number;
  isLongContext?: boolean;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  contextLength: number;
  isLongContext: boolean;
  costPerToken?: number;
}

export interface ProviderBlacklist {
  global: {
    models: string[];
    patterns: string[];
  };
  providers: Record<string, {
    models: string[];
    patterns: string[];
    reasons?: Record<string, {
      reason: string;
      addedAt: string;
      failureCount: number;
    }>;
  }>;
}

export interface LongContextWhitelist {
  global: ModelPriorityList;
  providers: Record<string, ModelPriorityList>;
}

export interface ModelPriorityList {
  models: Array<{
    name: string;
    priority: number;
  }>;
  patterns: Array<{
    pattern: string;
    priority: number;
  }>;
}

export interface BlacklistEntry {
  provider: string;
  model: string;
  reason: string;
  addedAt: string;
  failureCount: number;
}

export interface ConfigChange {
  type: 'added' | 'removed' | 'modified';
  field: string;
  oldValue?: any;
  newValue?: any;
}
```

## 质量要求

### CLI扩展标准
- ✅ 智能模型发现和测试
- ✅ 自动化配置优化
- ✅ 完整的黑名单和白名单管理
- ✅ 历史记录和重复检测
- ✅ 详细的操作日志和报告
- ✅ 错误处理和恢复机制

### 用户体验要求
- ✅ 直观的命令行界面
- ✅ 详细的进度显示
- ✅ 清晰的错误信息和建议
- ✅ 可编辑的配置文件
- ✅ 安全的API密钥处理

这个CLI扩展系统为RCC v4.0提供了强大的自动化管理功能，大大提升了系统的易用性和维护效率。