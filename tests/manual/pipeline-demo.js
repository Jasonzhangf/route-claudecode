/**
 * Pipeline系统手动演示
 * 
 * 绕过TypeScript编译问题，直接演示Pipeline核心功能
 * 
 * @author Jason Zhang
 */

const { EventEmitter } = require('events');

// 简化的模块基类
class SimpleModule extends EventEmitter {
  constructor(id, name, type) {
    super();
    this.id = id;
    this.name = name;
    this.type = type;
    this.status = 'stopped';
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      lastProcessedAt: null
    };
  }

  getId() { return this.id; }
  getName() { return this.name; }
  getType() { return this.type; }

  async start() {
    this.status = 'running';
    this.emit('started');
    console.log(`📦 模块 ${this.name} 已启动`);
  }

  async stop() {
    this.status = 'stopped';
    this.emit('stopped');
    console.log(`📦 模块 ${this.name} 已停止`);
  }

  async process(input) {
    const startTime = Date.now();
    console.log(`📦 ${this.name} 正在处理输入...`);
    
    try {
      const result = await this.onProcess(input);
      const processingTime = Date.now() - startTime;
      
      this.metrics.requestsProcessed++;
      this.metrics.lastProcessedAt = new Date();
      
      console.log(`✅ ${this.name} 处理完成 (${processingTime}ms)`);
      return result;
    } catch (error) {
      console.log(`❌ ${this.name} 处理失败: ${error.message}`);
      throw error;
    }
  }

  // 子类需要实现
  async onProcess(input) {
    throw new Error('子类必须实现 onProcess 方法');
  }
}

// Anthropic输入验证器
class AnthropicInputValidator extends SimpleModule {
  constructor() {
    super('validator-1', 'Anthropic Input Validator', 'validator');
  }

  async onProcess(input) {
    console.log(`🔍 验证输入格式...`);
    
    if (!input.model) {
      throw new Error('缺少 model 字段');
    }
    
    if (!input.messages || !Array.isArray(input.messages)) {
      throw new Error('缺少 messages 字段或格式不正确');
    }
    
    console.log(`✅ 输入验证通过: ${input.messages.length} 条消息`);
    return input;
  }
}

// Anthropic到OpenAI格式转换器
class AnthropicToOpenAITransformer extends SimpleModule {
  constructor() {
    super('transformer-1', 'Anthropic to OpenAI Transformer', 'transformer');
  }

  async onProcess(input) {
    console.log(`🔄 转换 Anthropic 格式到 OpenAI 格式...`);
    
    const openaiRequest = {
      model: 'gpt-3.5-turbo', // 映射模型名
      messages: input.messages,
      max_tokens: input.max_tokens || 1000,
      temperature: input.temperature || 0.7
    };

    if (input.tools) {
      openaiRequest.tools = input.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));
    }

    console.log(`✅ 格式转换完成: OpenAI 兼容格式`);
    return openaiRequest;
  }
}

// 简化的Pipeline实现
class SimplePipeline extends EventEmitter {
  constructor(id, name) {
    super();
    this.id = id;
    this.name = name;
    this.modules = [];
    this.status = 'stopped';
  }

  addModule(module) {
    this.modules.push(module);
    console.log(`➕ 添加模块: ${module.getName()}`);
  }

  async start() {
    console.log(`🚀 启动 Pipeline: ${this.name}`);
    this.status = 'starting';
    
    for (const module of this.modules) {
      await module.start();
    }
    
    this.status = 'running';
    console.log(`✅ Pipeline ${this.name} 启动完成`);
  }

  async stop() {
    console.log(`🛑 停止 Pipeline: ${this.name}`);
    this.status = 'stopping';
    
    for (const module of this.modules) {
      await module.stop();
    }
    
    this.status = 'stopped';
    console.log(`✅ Pipeline ${this.name} 已停止`);
  }

  async execute(input) {
    if (this.status !== 'running') {
      throw new Error(`Pipeline ${this.name} 未运行 (状态: ${this.status})`);
    }

    console.log(`\n🔄 执行 Pipeline: ${this.name}`);
    console.log(`📝 输入数据:`, JSON.stringify(input, null, 2));
    
    let currentInput = input;
    
    for (let i = 0; i < this.modules.length; i++) {
      const module = this.modules[i];
      console.log(`\n📦 步骤 ${i + 1}: ${module.getName()}`);
      
      try {
        currentInput = await module.process(currentInput);
      } catch (error) {
        console.log(`❌ Pipeline 执行失败于模块: ${module.getName()}`);
        throw error;
      }
    }
    
    console.log(`\n✅ Pipeline 执行完成`);
    console.log(`📋 输出数据:`, JSON.stringify(currentInput, null, 2));
    
    return currentInput;
  }
}

// Pipeline管理器
class SimplePipelineManager extends EventEmitter {
  constructor() {
    super();
    this.pipelines = new Map();
  }

  createPipeline(id, name) {
    const pipeline = new SimplePipeline(id, name);
    this.pipelines.set(id, pipeline);
    console.log(`📋 创建 Pipeline: ${name} (ID: ${id})`);
    return pipeline;
  }

  getPipeline(id) {
    return this.pipelines.get(id) || null;
  }

  async destroyPipeline(id) {
    const pipeline = this.pipelines.get(id);
    if (pipeline) {
      await pipeline.stop();
      this.pipelines.delete(id);
      console.log(`🗑️ 销毁 Pipeline: ${id}`);
      return true;
    }
    return false;
  }

  getAllPipelines() {
    return Array.from(this.pipelines.values());
  }

  getStatus() {
    const pipelines = Array.from(this.pipelines.values());
    return {
      totalPipelines: pipelines.length,
      runningPipelines: pipelines.filter(p => p.status === 'running').length,
      stoppedPipelines: pipelines.filter(p => p.status === 'stopped').length
    };
  }
}

// 演示函数
async function demonstratePipelineSystem() {
  console.log('\n🎯 RCC v4.0 Pipeline 管理系统演示\n');
  
  try {
    // 1. 创建Pipeline管理器
    console.log('=== 步骤 1: 初始化Pipeline管理器 ===');
    const pipelineManager = new SimplePipelineManager();
    
    // 2. 创建Pipeline
    console.log('\n=== 步骤 2: 创建测试Pipeline ===');
    const pipeline = pipelineManager.createPipeline('test-pipeline-1', 'LM Studio 测试Pipeline');
    
    // 3. 添加模块
    console.log('\n=== 步骤 3: 添加Pipeline模块 ===');
    const validator = new AnthropicInputValidator();
    const transformer = new AnthropicToOpenAITransformer();
    
    pipeline.addModule(validator);
    pipeline.addModule(transformer);
    
    // 4. 启动Pipeline
    console.log('\n=== 步骤 4: 启动Pipeline ===');
    await pipeline.start();
    
    // 5. 执行Pipeline
    console.log('\n=== 步骤 5: 执行Pipeline测试 ===');
    const testInput = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'Hello, world! 这是一个Pipeline测试。' }
      ],
      max_tokens: 100,
      temperature: 0.7
    };
    
    const result = await pipeline.execute(testInput);
    
    // 6. 显示状态
    console.log('\n=== 步骤 6: 系统状态 ===');
    const status = pipelineManager.getStatus();
    console.log('Pipeline Manager 状态:', status);
    
    // 7. 测试错误处理
    console.log('\n=== 步骤 7: 错误处理测试 ===');
    try {
      await pipeline.execute({ invalid: 'input' });
    } catch (error) {
      console.log('✅ 错误处理正常:', error.message);
    }
    
    // 8. 清理资源
    console.log('\n=== 步骤 8: 清理资源 ===');
    await pipeline.stop();
    await pipelineManager.destroyPipeline('test-pipeline-1');
    
    console.log('\n🎉 Pipeline 管理系统演示完成!');
    console.log('\n📊 演示总结:');
    console.log('✅ Pipeline 创建和管理');
    console.log('✅ 模块化架构');
    console.log('✅ 流水线执行');
    console.log('✅ 数据格式转换');
    console.log('✅ 错误处理');
    console.log('✅ 资源清理');
    
  } catch (error) {
    console.error('❌ 演示失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  demonstratePipelineSystem().catch(console.error);
}

module.exports = {
  SimpleModule,
  AnthropicInputValidator, 
  AnthropicToOpenAITransformer,
  SimplePipeline,
  SimplePipelineManager,
  demonstratePipelineSystem
};