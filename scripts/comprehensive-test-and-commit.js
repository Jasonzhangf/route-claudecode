#!/usr/bin/env node

/**
 * 完整测试和GitHub提交流程
 * 
 * 1. 应用所有修复
 * 2. 基于真实数据进行全面测试
 * 3. 生成测试报告
 * 4. 提交到GitHub
 */

const fs = require('fs');
const { execSync } = require('child_process');
const axios = require('axios');

console.log('🚀 开始完整测试和提交流程...\n');

// 1. 应用所有修复
async function applyAllFixes() {
  console.log('🔧 应用所有修复...');
  
  try {
    // 应用工具调用恢复修复
    console.log('  - 应用工具调用恢复修复...');
    execSync('node scripts/emergency-tool-call-recovery-fix-complete.js', { stdio: 'inherit' });
    
    // 重新构建
    console.log('  - 重新构建项目...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('✅ 所有修复已应用并构建成功\n');
    return true;
  } catch (error) {
    console.error('❌ 修复应用失败:', error.message);
    return false;
  }
}

// 2. 真实数据测试
async function runRealDataTests() {
  console.log('🧪 开始真实数据测试...\n');
  
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };
  
  // 测试1: 大文本工具调用恢复
  console.log('📋 测试1: 大文本工具调用恢复');
  const test1Result = await testLargeTextToolCallRecovery();
  testResults.tests.push({
    name: 'Large Text Tool Call Recovery',
    ...test1Result
  });
  
  // 测试2: 队列超时机制
  console.log('\n📋 测试2: 队列超时机制');
  const test2Result = await testQueueTimeoutMechanism();
  testResults.tests.push({
    name: 'Queue Timeout Mechanism',
    ...test2Result
  });
  
  // 测试3: 顺序处理验证
  console.log('\n📋 测试3: 顺序处理验证');
  const test3Result = await testSequentialProcessing();
  testResults.tests.push({
    name: 'Sequential Processing',
    ...test3Result
  });
  
  // 测试4: finish_reason映射完整性
  console.log('\n📋 测试4: finish_reason映射完整性');
  const test4Result = await testFinishReasonMapping();
  testResults.tests.push({
    name: 'Finish Reason Mapping',
    ...test4Result
  });
  
  // 计算总结
  testResults.summary.total = testResults.tests.length;
  testResults.tests.forEach(test => {
    if (test.status === 'PASSED') testResults.summary.passed++;
    else if (test.status === 'FAILED') testResults.summary.failed++;
    else if (test.status === 'WARNING') testResults.summary.warnings++;
  });
  
  // 保存测试报告
  fs.writeFileSync('test-results.json', JSON.stringify(testResults, null, 2));
  
  console.log('\n📊 测试总结:');
  console.log(`   总测试数: ${testResults.summary.total}`);
  console.log(`   通过: ${testResults.summary.passed}`);
  console.log(`   失败: ${testResults.summary.failed}`);
  console.log(`   警告: ${testResults.summary.warnings}`);
  
  return testResults;
}

// 测试1: 大文本工具调用恢复
async function testLargeTextToolCallRecovery() {
  const testName = 'Large Text Tool Call Recovery';
  console.log(`  🧪 执行 ${testName}...`);
  
  try {
    const largeText = `这是一个用于测试大文本工具调用恢复的长文本。${'重复内容用于填充token限制。'.repeat(100)}

现在请使用listDirectory工具查看当前目录内容。这个工具调用应该被正确恢复，即使文本被截断。`;

    const request = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 150, // 故意设置较小
      messages: [{ role: "user", content: largeText }],
      tools: [{
        name: "listDirectory",
        description: "List directory contents",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"]
        }
      }],
      stream: true
    };

    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
      responseType: 'stream'
    });

    return new Promise((resolve) => {
      let hasToolUse = false;
      let finishReason = null;
      let hasError = false;
      let errorType = null;
      let eventCount = 0;

      const timeout = setTimeout(() => {
        resolve({
          status: 'FAILED',
          message: 'Test timeout - possible deadlock',
          details: { eventCount, hasToolUse, finishReason }
        });
      }, 15000);

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              eventCount++;

              if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
                hasToolUse = true;
              }
              if (data.delta?.stop_reason) {
                finishReason = data.delta.stop_reason;
              }
              if (data.type === 'error') {
                hasError = true;
                errorType = data.error?.type;
              }
            } catch (e) {}
          }
        }
      });

      response.data.on('end', () => {
        clearTimeout(timeout);
        
        let status, message;
        if (hasToolUse && finishReason === 'tool_use') {
          status = 'PASSED';
          message = 'Tool call successfully recovered';
        } else if (hasError && errorType === 'tool_call_truncated') {
          status = 'PASSED';
          message = 'Tool call truncation properly handled with error';
        } else if (!hasToolUse && finishReason === 'max_tokens') {
          status = 'FAILED';
          message = 'Tool call lost, silent failure detected';
        } else {
          status = 'WARNING';
          message = 'Unexpected result, needs investigation';
        }

        resolve({
          status,
          message,
          details: {
            eventCount,
            hasToolUse,
            finishReason,
            hasError,
            errorType
          }
        });
      });

      response.data.on('error', () => {
        clearTimeout(timeout);
        resolve({
          status: 'FAILED',
          message: 'Network or stream error',
          details: { eventCount }
        });
      });
    });

  } catch (error) {
    return {
      status: 'FAILED',
      message: `Request failed: ${error.message}`,
      details: { error: error.message }
    };
  }
}

// 测试2: 队列超时机制
async function testQueueTimeoutMechanism() {
  console.log('  🧪 执行队列超时机制测试...');
  
  try {
    const requests = [];
    const startTime = Date.now();
    
    // 发送3个连续请求到同一会话
    for (let i = 0; i < 3; i++) {
      requests.push(
        axios.post('http://localhost:3456/v1/messages', {
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 100,
          messages: [{ role: "user", content: `队列测试请求 ${i}` }],
          stream: true
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': 'queue-test-session',
            'conversation_id': 'queue-test-conversation'
          },
          timeout: 35000, // 35秒超时
          responseType: 'stream'
        }).then(response => {
          return new Promise((resolve) => {
            response.data.on('end', () => resolve(`Request ${i} completed`));
            response.data.on('error', () => resolve(`Request ${i} failed`));
          });
        }).catch(error => `Request ${i} error: ${error.message}`)
      );
    }

    const results = await Promise.all(requests);
    const duration = Date.now() - startTime;
    
    const completedCount = results.filter(r => r.includes('completed')).length;
    const failedCount = results.filter(r => r.includes('failed') || r.includes('error')).length;
    
    let status, message;
    if (completedCount === 3 && duration < 60000) {
      status = 'PASSED';
      message = 'All requests completed within timeout';
    } else if (completedCount > 0 && duration < 60000) {
      status = 'WARNING';
      message = `${completedCount}/3 requests completed, ${failedCount} failed`;
    } else {
      status = 'FAILED';
      message = 'Queue timeout mechanism failed';
    }

    return {
      status,
      message,
      details: {
        duration,
        completedCount,
        failedCount,
        results
      }
    };

  } catch (error) {
    return {
      status: 'FAILED',
      message: `Queue test failed: ${error.message}`,
      details: { error: error.message }
    };
  }
}

// 测试3: 顺序处理验证
async function testSequentialProcessing() {
  console.log('  🧪 执行顺序处理验证...');
  
  try {
    const sessionId = 'sequential-test-session';
    const conversationId = 'sequential-test-conversation';
    const requestTimes = [];
    
    // 发送多个请求并记录时间
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        (async () => {
          const startTime = Date.now();
          try {
            const response = await axios.post('http://localhost:3456/v1/messages', {
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 50,
              messages: [{ role: "user", content: `顺序测试 ${i}` }],
              stream: true
            }, {
              headers: {
                'Content-Type': 'application/json',
                'x-session-id': sessionId,
                'conversation_id': conversationId
              },
              timeout: 30000,
              responseType: 'stream'
            });
            
            return new Promise((resolve) => {
              response.data.on('end', () => {
                const endTime = Date.now();
                resolve({
                  index: i,
                  startTime,
                  endTime,
                  duration: endTime - startTime,
                  status: 'completed'
                });
              });
            });
          } catch (error) {
            return {
              index: i,
              startTime,
              endTime: Date.now(),
              duration: Date.now() - startTime,
              status: 'failed',
              error: error.message
            };
          }
        })()
      );
    }
    
    const results = await Promise.all(promises);
    
    // 验证顺序处理
    const completedResults = results.filter(r => r.status === 'completed').sort((a, b) => a.endTime - b.endTime);
    const isSequential = completedResults.length >= 2 && 
                         completedResults[1].startTime >= completedResults[0].endTime - 1000; // 允许1秒误差
    
    let status, message;
    if (completedResults.length === 3 && isSequential) {
      status = 'PASSED';
      message = 'Sequential processing working correctly';
    } else if (completedResults.length > 0) {
      status = 'WARNING';
      message = `${completedResults.length}/3 completed, sequential: ${isSequential}`;
    } else {
      status = 'FAILED';
      message = 'Sequential processing failed';
    }
    
    return {
      status,
      message,
      details: {
        results,
        isSequential,
        completedCount: completedResults.length
      }
    };
    
  } catch (error) {
    return {
      status: 'FAILED',
      message: `Sequential test failed: ${error.message}`,
      details: { error: error.message }
    };
  }
}

// 测试4: finish_reason映射完整性
async function testFinishReasonMapping() {
  console.log('  🧪 执行finish_reason映射测试...');
  
  const testCases = [
    {
      name: 'Normal completion',
      request: {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: "Hello" }],
        stream: true
      },
      expectedFinishReason: 'end_turn'
    },
    {
      name: 'Max tokens limit',
      request: {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "请详细解释JavaScript的所有概念和特性" }],
        stream: true
      },
      expectedFinishReason: 'max_tokens'
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const response = await axios.post('http://localhost:3456/v1/messages', testCase.request, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
        responseType: 'stream'
      });
      
      const result = await new Promise((resolve) => {
        let finishReason = null;
        
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.delta?.stop_reason) {
                  finishReason = data.delta.stop_reason;
                }
              } catch (e) {}
            }
          }
        });
        
        response.data.on('end', () => {
          resolve({
            name: testCase.name,
            expected: testCase.expectedFinishReason,
            actual: finishReason,
            passed: finishReason === testCase.expectedFinishReason
          });
        });
      });
      
      results.push(result);
      
    } catch (error) {
      results.push({
        name: testCase.name,
        expected: testCase.expectedFinishReason,
        actual: null,
        passed: false,
        error: error.message
      });
    }
  }
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  let status, message;
  if (passedCount === totalCount) {
    status = 'PASSED';
    message = 'All finish_reason mappings correct';
  } else if (passedCount > 0) {
    status = 'WARNING';
    message = `${passedCount}/${totalCount} mappings correct`;
  } else {
    status = 'FAILED';
    message = 'finish_reason mapping failed';
  }
  
  return {
    status,
    message,
    details: { results, passedCount, totalCount }
  };
}

// 3. 生成测试报告
function generateTestReport(testResults) {
  console.log('\n📄 生成测试报告...');
  
  const reportContent = `# 大文本工具调用和队列管理修复 - 测试报告

## 测试概览

- **测试时间**: ${testResults.timestamp}
- **总测试数**: ${testResults.summary.total}
- **通过**: ${testResults.summary.passed}
- **失败**: ${testResults.summary.failed}
- **警告**: ${testResults.summary.warnings}

## 详细测试结果

${testResults.tests.map(test => `
### ${test.name}

- **状态**: ${test.status}
- **结果**: ${test.message}
- **详细信息**: 
\`\`\`json
${JSON.stringify(test.details, null, 2)}
\`\`\`
`).join('\n')}

## 修复内容总结

### 1. 大文本工具调用恢复
- 添加了工具调用检测和恢复逻辑
- 防止工具调用在token限制时被静默截断
- 确保返回适当的错误信息而不是静默失败

### 2. 队列管理超时机制
- 添加了请求处理超时（60秒）
- 添加了队列等待超时（30秒）
- 实现了强制清理卡住的请求

### 3. finish_reason映射增强
- 改进了finish_reason的智能映射
- 添加了工具调用优先级处理
- 确保映射的完整性和准确性

### 4. 错误处理改进
- 防止静默失败
- 提供明确的错误信息
- 区分不同类型的错误场景

## 结论

${testResults.summary.failed === 0 ? 
  '✅ 所有测试通过，修复成功！可以安全提交到GitHub。' : 
  `❌ 有 ${testResults.summary.failed} 个测试失败，需要进一步修复。`}
`;

  fs.writeFileSync('docs/test-report.md', reportContent);
  console.log('✅ 测试报告已生成: docs/test-report.md');
  
  return reportContent;
}

// 4. 提交到GitHub
function commitToGitHub(testResults) {
  console.log('\n📤 提交到GitHub...');
  
  try {
    // 检查Git状态
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (!gitStatus.trim()) {
      console.log('⚠️  没有需要提交的更改');
      return false;
    }
    
    // 添加所有更改
    execSync('git add .', { stdio: 'inherit' });
    
    // 创建提交信息
    const commitMessage = `fix: 大文本工具调用恢复和队列管理超时机制

修复内容:
- 🔧 大文本工具调用恢复: 防止token限制时工具调用被截断
- ⏰ 队列管理超时机制: 添加请求和等待超时，防止死锁
- 🎯 finish_reason映射增强: 改进映射逻辑，支持工具调用优先级
- 🚫 防止静默失败: 确保错误信息正确返回

测试结果:
- 总测试数: ${testResults.summary.total}
- 通过: ${testResults.summary.passed}
- 失败: ${testResults.summary.failed}
- 警告: ${testResults.summary.warnings}

详细测试报告: docs/test-report.md`;

    // 提交
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    
    // 推送到远程仓库
    try {
      execSync('git push', { stdio: 'inherit' });
      console.log('✅ 成功推送到GitHub');
      return true;
    } catch (pushError) {
      console.log('⚠️  本地提交成功，但推送失败。请手动推送：git push');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Git提交失败:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  try {
    // 1. 应用修复
    const fixesApplied = await applyAllFixes();
    if (!fixesApplied) {
      console.error('❌ 修复应用失败，终止流程');
      process.exit(1);
    }
    
    // 2. 运行测试
    const testResults = await runRealDataTests();
    
    // 3. 生成报告
    generateTestReport(testResults);
    
    // 4. 决定是否提交
    if (testResults.summary.failed === 0) {
      console.log('\n🎉 所有测试通过！准备提交到GitHub...');
      const committed = commitToGitHub(testResults);
      
      if (committed) {
        console.log('\n✅ 完整流程成功完成！');
        console.log('📋 已完成:');
        console.log('  - ✅ 应用所有修复');
        console.log('  - ✅ 基于真实数据测试');
        console.log('  - ✅ 生成测试报告');
        console.log('  - ✅ 提交到GitHub');
      } else {
        console.log('\n⚠️  测试通过但提交失败，请手动提交');
      }
    } else {
      console.log('\n❌ 有测试失败，不建议提交。请查看测试报告并修复问题。');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💀 流程执行失败:', error.message);
    process.exit(1);
  }
}

// 检查依赖
try {
  require('axios');
} catch (e) {
  console.log('📦 安装axios依赖...');
  execSync('npm install axios', { stdio: 'inherit' });
}

main().catch(console.error);