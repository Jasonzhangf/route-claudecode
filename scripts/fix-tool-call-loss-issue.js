#!/usr/bin/env node
/**
 * 🔧 修复工具调用丢失问题
 * 
 * 问题：工具调用检测成功，但在后续处理中被丢失
 * 解决：在关键处理点添加工具调用保护逻辑
 */

const fs = require('fs').promises;

console.log('🔧 [TOOL-CALL-LOSS-FIX] 开始修复工具调用丢失问题...');

async function addToolCallTrackingLogs() {
  console.log('📝 1. 在一致性验证器中添加详细日志...');
  
  const validatorPath = 'src/output/anthropic/consistency-validator.ts';
  
  try {
    let content = await fs.readFile(validatorPath, 'utf8');
    
    // 在countToolUseBlocks方法中添加详细日志
    const oldCountMethod = `  private countToolUseBlocks(response: AnthropicResponse): number {
    if (!response.content || !Array.isArray(response.content)) {
      return 0;
    }

    return response.content.filter(block => block.type === 'tool_use').length;
  }`;
    
    const newCountMethod = `  private countToolUseBlocks(response: AnthropicResponse): number {
    if (!response.content || !Array.isArray(response.content)) {
      this.logger.debug('🔍 [TOOL-COUNT] No content array found', {
        hasContent: !!response.content,
        isArray: Array.isArray(response.content)
      });
      return 0;
    }

    const toolBlocks = response.content.filter(block => block.type === 'tool_use');
    const textBlocks = response.content.filter(block => block.type === 'text');
    
    this.logger.debug('🔍 [TOOL-COUNT] Content analysis', {
      totalBlocks: response.content.length,
      toolBlocks: toolBlocks.length,
      textBlocks: textBlocks.length,
      blockTypes: response.content.map(b => b.type),
      textContent: textBlocks.map(b => b.text?.substring(0, 50) + '...'),
      toolNames: toolBlocks.map(b => b.name)
    });
    
    // 检查文本块中是否包含未转换的工具调用
    const textWithToolCalls = textBlocks.filter(block => 
      block.text && block.text.includes('Tool call:')
    );
    
    if (textWithToolCalls.length > 0) {
      this.logger.warn('🚨 [TOOL-COUNT] Found unconverted tool calls in text blocks', {
        unconvertedCount: textWithToolCalls.length,
        samples: textWithToolCalls.map(b => b.text?.substring(0, 100) + '...')
      });
    }

    return toolBlocks.length;
  }`;
    
    if (content.includes(oldCountMethod)) {
      content = content.replace(oldCountMethod, newCountMethod);
      console.log('   ✅ 添加了详细的工具计数日志');
    } else {
      console.log('   ⚠️ 未找到预期的countToolUseBlocks方法');
    }
    
    await fs.writeFile(validatorPath, content, 'utf8');
    console.log(`   ✅ ${validatorPath} 更新完成`);
    
  } catch (error) {
    console.error(`   ❌ 更新失败:`, error.message);
  }
}

async function addResponsePipelineTracking() {
  console.log('📝 2. 在响应流水线中添加工具调用追踪...');
  
  const pipelinePath = 'src/pipeline/response-pipeline.ts';
  
  try {
    let content = await fs.readFile(pipelinePath, 'utf8');
    
    // 在process方法中添加工具调用追踪
    const oldProcessStart = `  async process(data: any, context: PipelineContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Preprocessing stage started', {
        dataType: typeof data,
        hasContent: !!data?.content,
        isStreaming: context.isStreaming
      }, context.requestId, 'pipeline-preprocessing');`;
    
    const newProcessStart = `  async process(data: any, context: PipelineContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 🔍 追踪工具调用 - 处理前
      const toolCountBefore = this.countToolCalls(data);
      this.logger.debug('Preprocessing stage started', {
        dataType: typeof data,
        hasContent: !!data?.content,
        isStreaming: context.isStreaming,
        toolCallsBefore: toolCountBefore,
        contentBlocks: data?.content?.length || 0,
        contentTypes: data?.content?.map((b: any) => b.type) || []
      }, context.requestId, 'pipeline-preprocessing');`;
    
    if (content.includes(oldProcessStart)) {
      content = content.replace(oldProcessStart, newProcessStart);
      console.log('   ✅ 添加了处理前的工具调用追踪');
    }
    
    // 在process方法结束前添加追踪
    const oldProcessEnd = `      const duration = Date.now() - startTime;
      this.logger.debug('Preprocessing stage completed', {
        duration: \`\${duration}ms\`,
        hasChanges: processedData !== data,
        toolCallsDetected: this.countToolCalls(processedData)
      }, context.requestId, 'pipeline-preprocessing');

      return cleanedData;`;
    
    const newProcessEnd = `      const duration = Date.now() - startTime;
      const toolCountAfter = this.countToolCalls(cleanedData);
      const toolCountProcessed = this.countToolCalls(processedData);
      
      this.logger.debug('Preprocessing stage completed', {
        duration: \`\${duration}ms\`,
        hasChanges: processedData !== data,
        toolCallsBefore: toolCountBefore,
        toolCallsAfterDetection: toolCountProcessed,
        toolCallsAfterCleaning: toolCountAfter,
        contentBlocksAfter: cleanedData?.content?.length || 0,
        contentTypesAfter: cleanedData?.content?.map((b: any) => b.type) || []
      }, context.requestId, 'pipeline-preprocessing');
      
      // 🚨 检查工具调用是否丢失
      if (toolCountProcessed > toolCountAfter) {
        this.logger.warn('🚨 Tool calls lost during cleaning stage', {
          beforeCleaning: toolCountProcessed,
          afterCleaning: toolCountAfter,
          lostCount: toolCountProcessed - toolCountAfter
        }, context.requestId, 'pipeline-tool-loss');
      }

      return cleanedData;`;
    
    if (content.includes(oldProcessEnd)) {
      content = content.replace(oldProcessEnd, newProcessEnd);
      console.log('   ✅ 添加了处理后的工具调用追踪');
    }
    
    await fs.writeFile(pipelinePath, content, 'utf8');
    console.log(`   ✅ ${pipelinePath} 更新完成`);
    
  } catch (error) {
    console.error(`   ❌ 更新失败:`, error.message);
  }
}

async function addOutputProcessorTracking() {
  console.log('📝 3. 在输出处理器中添加工具调用追踪...');
  
  const outputPath = 'src/output/anthropic/processor.ts';
  
  try {
    let content = await fs.readFile(outputPath, 'utf8');
    
    // 查找process方法并添加追踪
    const processMethodPattern = /async process\(response: any, request: BaseRequest\): Promise<AnthropicResponse> \{/;
    
    if (processMethodPattern.test(content)) {
      // 在方法开始添加追踪
      content = content.replace(
        processMethodPattern,
        `async process(response: any, request: BaseRequest): Promise<AnthropicResponse> {
    // 🔍 追踪工具调用 - 输出处理前
    const toolCountBefore = this.countToolCalls(response);
    this.logger.debug('🔍 [OUTPUT-PROCESSOR] Starting output processing', {
      toolCallsBefore: toolCountBefore,
      contentBlocks: response?.content?.length || 0,
      contentTypes: response?.content?.map((b: any) => b.type) || [],
      stopReason: response?.stop_reason
    });`
      );
      console.log('   ✅ 添加了输出处理前的追踪');
    }
    
    // 添加工具计数方法
    const countToolCallsMethod = `
  /**
   * 计算工具调用数量
   */
  private countToolCalls(data: any): number {
    if (!data?.content || !Array.isArray(data.content)) {
      return 0;
    }
    return data.content.filter((block: any) => block.type === 'tool_use').length;
  }`;
    
    // 在类的最后添加方法
    const classEndPattern = /}\s*$/;
    content = content.replace(classEndPattern, countToolCallsMethod + '\n}');
    
    await fs.writeFile(outputPath, content, 'utf8');
    console.log(`   ✅ ${outputPath} 更新完成`);
    
  } catch (error) {
    console.error(`   ❌ 更新失败:`, error.message);
  }
}

async function createValidationScript() {
  console.log('📝 4. 创建修复验证脚本...');
  
  const validationPath = 'scripts/validate-tool-call-loss-fix.js';
  const validationContent = `#!/usr/bin/env node
/**
 * 🔍 验证工具调用丢失修复效果
 */

const http = require('http');

const TEST_REQUEST = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: "请帮我创建一个名为test.txt的文件，内容是'Hello World'"
    }
  ],
  tools: [
    {
      name: "Write",
      description: "Write content to a file",
      input_schema: {
        type: "object",
        properties: {
          content: { type: "string" },
          file_path: { type: "string" }
        },
        required: ["content", "file_path"]
      }
    }
  ],
  stream: false
};

async function validateFix() {
  console.log('🔍 验证工具调用丢失修复效果...');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(TEST_REQUEST);
    
    const options = {
      hostname: '127.0.0.1',
      port: 3456,
      path: '/v1/messages?beta=true',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log(\`📊 响应状态: \${res.statusCode}\`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          console.log('\\n📊 响应分析:');
          console.log(\`Stop reason: \${response.stop_reason}\`);
          console.log(\`Content blocks: \${response.content?.length || 0}\`);
          
          if (response.content) {
            response.content.forEach((block, index) => {
              console.log(\`  \${index + 1}. \${block.type}\${block.type === 'tool_use' ? \` - \${block.name}\` : ''}\`);
            });
          }
          
          const hasToolCalls = response.content?.some(b => b.type === 'tool_use');
          const correctStopReason = response.stop_reason === 'tool_use';
          
          console.log('\\n🎯 验证结果:');
          console.log(\`工具调用检测: \${hasToolCalls ? '✅' : '❌'}\`);
          console.log(\`Stop reason正确: \${correctStopReason ? '✅' : '❌'}\`);
          
          if (hasToolCalls && correctStopReason) {
            console.log('\\n✅ 修复成功！工具调用没有丢失');
          } else {
            console.log('\\n❌ 仍有问题，需要进一步调试');
          }
          
          resolve();
        } catch (error) {
          console.error('解析响应失败:', error);
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

if (require.main === module) {
  validateFix().catch(console.error);
}`;
  
  try {
    await fs.writeFile(validationPath, validationContent, 'utf8');
    console.log(`   ✅ 创建了验证脚本: ${validationPath}`);
  } catch (error) {
    console.error(`   ❌ 创建验证脚本失败:`, error.message);
  }
}

async function main() {
  console.log('🚀 开始修复工具调用丢失问题...');
  
  await addToolCallTrackingLogs();
  await addResponsePipelineTracking();
  await addOutputProcessorTracking();
  await createValidationScript();
  
  console.log('\\n✅ 修复完成！');
  console.log('\\n📋 修复内容:');
  console.log('   1. 在一致性验证器中添加了详细的工具计数日志');
  console.log('   2. 在响应流水线中添加了工具调用追踪');
  console.log('   3. 在输出处理器中添加了工具调用追踪');
  console.log('   4. 创建了修复效果验证脚本');
  console.log('\\n🔧 下一步:');
  console.log('   1. 重启服务器以应用修复');
  console.log('   2. 运行验证脚本: node scripts/validate-tool-call-loss-fix.js');
  console.log('   3. 查看详细日志来定位工具调用丢失的具体位置');
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 修复失败:', error);
    process.exit(1);
  });
}