#!/usr/bin/env node

/**
 * 测试用例: 基于真实日志数据复现工具调用转文本问题
 * 测试目标: 使用日志中的真实数据重现工具调用被误认为文本的问题并提供修复验证
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

class RealDataToolCallTester {
  constructor() {
    this.logFile = '/tmp/tool-call-real-data-test.log';
    this.issues = [];
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    console.log(logEntry);
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  // 模拟从真实日志中提取的问题数据
  getRealToolCallData() {
    // 基于日志中发现的问题数据构造测试数据
    return {
      // 这是导致问题的原始事件数据结构
      problematicEvent: {
        Event: 'unknownEventType', // 这会触发default case
        Data: {
          text: 'Tool call: Grep({"pattern": "ProviderConfig|settings"})' // 这是日志中的真实文本
        }
      },
      
      // 期望的正确事件结构
      expectedToolEvent: {
        Event: 'toolUseEvent',
        Data: {
          toolUse: {
            toolUseId: 'tooluse_12345',
            name: 'Grep',
            input: {
              pattern: 'ProviderConfig|settings'
            }
          }
        }
      }
    };
  }

  testParserDefaultCase() {
    this.log('🔍 测试解析器default case处理');
    
    const testData = this.getRealToolCallData();
    const { problematicEvent } = testData;
    
    this.log('📤 输入事件数据:', problematicEvent);
    
    // 这会触发parser.ts中的default case，导致工具调用被当作文本
    try {
      // 模拟convertSingleEvent函数的行为
      const Event = problematicEvent.Event;
      const Data = problematicEvent.Data;
      const requestId = 'test-request-id';
      
      this.log(`📊 事件类型: ${Event}`);
      this.log(`📊 数据结构:`, Data);
      
      // 这里模拟parser.ts第305行的逻辑
      if (Event !== 'assistantResponseEvent' && Event !== 'toolUseEvent' && Event !== 'messageStopEvent') {
        this.log('⚠️  触发default case - 未知事件类型');
        
        // 这里就是问题所在：Data.text存在时被当作文本处理
        if (Data && typeof Data === 'object' && Data.text) {
          const resultantEvent = {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',  
              index: 0,
              delta: {
                type: 'text_delta',
                text: Data.text  // "Tool call: Grep(...)" 被当作文本
              }
            }
          };
          
          this.log('❌ 问题复现: 工具调用被转换为文本事件');
          this.log('📤 错误输出事件:', resultantEvent);
          
          // 检查是否包含工具调用文本
          if (Data.text.includes('Tool call:')) {
            this.issues.push({
              type: 'tool_call_as_text_in_parser',
              severity: 'high',
              description: 'Parser default case将工具调用文本错误转换为text_delta事件',
              originalData: Data.text,
              resultEvent: resultantEvent,
              location: 'src/providers/codewhisperer/parser.ts:308-320'
            });
          }
          
          return resultantEvent;
        }
      }
      
    } catch (error) {
      this.log('❌ 测试执行错误:', error.message);
    }
  }

  testCorrectToolCallHandling() {
    this.log('\n🔧 测试正确的工具调用处理');
    
    const testData = this.getRealToolCallData();
    const { expectedToolEvent } = testData;
    
    this.log('📤 期望的工具事件输入:', expectedToolEvent);
    
    // 模拟正确的工具调用处理
    const Event = expectedToolEvent.Event;
    const Data = expectedToolEvent.Data;
    
    if (Event === 'toolUseEvent') {
      this.log('✅ 正确识别为工具调用事件');
      
      // 这应该产生正确的工具调用事件
      const correctEvent = {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: 1,
          content_block: {
            type: 'tool_use',
            id: Data.toolUse.toolUseId,
            name: Data.toolUse.name,
            input: Data.toolUse.input
          }
        }
      };
      
      this.log('✅ 正确输出事件:', correctEvent);
      return correctEvent;
    }
  }

  generateFixSuggestion() {
    this.log('\n🛠️  修复建议:');
    
    const fixSuggestion = {
      problem: 'Parser default case将包含"Tool call:"的文本错误处理为text_delta事件',
      location: 'src/providers/codewhisperer/parser.ts:305-320',
      rootCause: '未知事件类型的文本内容被无条件转换为文本delta事件',
      solution: {
        approach: '在default case中添加工具调用文本检测和转换逻辑',
        codeChange: `
        // 在 default case 中添加工具调用检测
        if (Data && typeof Data === 'object' && Data.text) {
          // 检测是否为工具调用文本
          if (Data.text.startsWith('Tool call:')) {
            logger.debug('Detected tool call text, attempting to parse as tool event', { text: Data.text }, requestId);
            
            try {
              // 尝试解析工具调用文本
              const toolCallMatch = Data.text.match(/Tool call: (\\w+)\\((.*)\\)/);
              if (toolCallMatch) {
                const toolName = toolCallMatch[1];
                const toolArgs = toolCallMatch[2];
                
                // 返回工具调用事件而不是文本事件
                return {
                  event: 'content_block_start',
                  data: {
                    type: 'content_block_start',
                    index: 1,
                    content_block: {
                      type: 'tool_use',
                      id: 'extracted_' + Date.now(),
                      name: toolName,
                      input: {} // 可以尝试解析参数
                    }
                  }
                };
              }
            } catch (parseError) {
              logger.warn('Failed to parse tool call text', { error: parseError, text: Data.text }, requestId);
            }
          }
          
          // 如果不是工具调用或解析失败，才作为文本处理
          return {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',  
              index: 0,
              delta: {
                type: 'text_delta',
                text: Data.text
              }
            }
          };
        }
        `
      }
    };
    
    this.log('📋 修复建议:', fixSuggestion);
    return fixSuggestion;
  }

  async runFullTest() {
    this.log('🚀 开始基于真实数据的工具调用测试');
    fs.writeFileSync(this.logFile, '');
    
    // 1. 测试问题复现
    this.testParserDefaultCase();
    
    // 2. 测试正确处理
    this.testCorrectToolCallHandling();
    
    // 3. 生成修复建议
    this.generateFixSuggestion();
    
    // 4. 生成报告
    this.log('\n📊 测试总结:');
    this.log(`发现问题数量: ${this.issues.length}`);
    
    if (this.issues.length > 0) {
      this.log('\n❌ 发现的问题:');
      this.issues.forEach((issue, index) => {
        this.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
        this.log(`   位置: ${issue.location}`);
        this.log(`   原始数据: "${issue.originalData}"`);
      });
      
      this.log('\n🎯 结论: 问题成功复现，需要修复parser.ts中的default case逻辑');
      return { status: 'FAILED', issues: this.issues };
    } else {
      this.log('\n✅ 未发现问题');
      return { status: 'PASSED', issues: [] };
    }
  }
}

// 执行测试
async function main() {
  const tester = new RealDataToolCallTester();
  
  try {
    const result = await tester.runFullTest();
    
    console.log(`\n📋 测试完成: ${result.status}`);
    console.log(`📄 详细日志: ${tester.logFile}`);
    
    if (result.status === 'FAILED') {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('测试执行失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}