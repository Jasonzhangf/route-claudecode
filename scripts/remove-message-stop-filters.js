#!/usr/bin/env node

/**
 * 🗑️ 移除过时的message_stop过滤策略
 * 
 * 根据用户要求，完全取消message_stop的过滤策略，因为那是过时的设计
 * 让message_stop事件始终正常发送，不再根据工具调用状态进行过滤
 */

const fs = require('fs');
const path = require('path');

console.log('🗑️ [REMOVE-MESSAGE-STOP-FILTERS] Starting removal of outdated message_stop filtering...');

// 需要修复的文件列表
const filesToFix = [
  'src/server.ts',
  'src/transformers/streaming.ts', 
  'src/server/handlers/streaming-handler.ts',
  'src/providers/openai/enhanced-client.ts',
  'src/providers/openai/sdk-client.ts'
];

// 修复模式定义
const fixPatterns = [
  {
    name: '移除server.ts中的message_stop条件发送',
    file: 'src/server.ts',
    search: /} else if \(processedChunk\.event === 'message_stop'\) \{[\s\S]*?this\.sendSSEEvent\(reply, processedChunk\.event, processedChunk\.data\);[\s\S]*?\}/g,
    replace: `} else if (processedChunk.event === 'message_stop') {
          // 🔧 修复：始终发送message_stop事件，不再进行过滤
          this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
          this.logger.debug('Sent message_stop event', { requestId });`
  },
  {
    name: '移除streaming.ts中的message_stop条件发送',
    file: 'src/transformers/streaming.ts',
    search: /\/\/ 只有在非tool_use场景才发送message_stop[\s\S]*?if \(actualStopReason !== 'tool_use'\) \{[\s\S]*?const messageStopEvent[\s\S]*?\}[\s\S]*?\/\/ 不发送message_stop事件，避免会话终止/g,
    replace: `// 🔧 修复：始终发送message_stop事件，不再根据工具调用状态过滤
        const messageStopEvent = this.createAnthropicEvent('message_stop', {
          type: 'message_stop'
        });
        if (messageStopEvent) {
          yield messageStopEvent;
        }`
  },
  {
    name: '移除streaming-handler.ts中的message_stop条件发送',
    file: 'src/server/handlers/streaming-handler.ts',
    search: /} else if \(chunk\.event === 'message_stop'\) \{[\s\S]*?if \(hasToolUse\) \{[\s\S]*?this\.sendSSEEvent\(reply, chunk\.event, chunk\.data\);[\s\S]*?\}/g,
    replace: `} else if (chunk.event === 'message_stop') {
      // 🔧 修复：始终发送message_stop事件，不再进行条件过滤
      this.sendSSEEvent(reply, chunk.event, chunk.data);`
  },
  {
    name: '移除enhanced-client.ts中的message_stop条件发送',
    file: 'src/providers/openai/enhanced-client.ts',
    search: /\/\/ 只有非工具调用场景才发送message_stop[\s\S]*?if \([^}]*!== 'tool_use'\) \{[\s\S]*?event: 'message_stop'[\s\S]*?\}[\s\S]*?\}/g,
    replace: `// 🔧 修复：始终发送message_stop事件
                  yield {
                    event: 'message_stop',
                    data: { type: 'message_stop' }
                  };`
  },
  {
    name: '移除sdk-client.ts中的message_stop条件发送',
    file: 'src/providers/openai/sdk-client.ts',
    search: /\/\/ 只有非工具调用场景才发送message_stop[\s\S]*?if \([^}]*!== 'tool_use'\) \{[\s\S]*?event: 'message_stop'[\s\S]*?\}[\s\S]*?\}/g,
    replace: `// 🔧 修复：始终发送message_stop事件
          yield {
            event: 'message_stop',
            data: { type: 'message_stop' }
          };`
  }
];

async function removeMessageStopFilters() {
  console.log('\n🔍 开始移除message_stop过滤逻辑...\n');
  
  let totalChanges = 0;
  
  for (const pattern of fixPatterns) {
    console.log(`📝 处理: ${pattern.name}`);
    
    const filePath = pattern.file;
    if (!fs.existsSync(filePath)) {
      console.log(`   ⚠️ 文件不存在: ${filePath}`);
      continue;
    }
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // 应用替换
      content = content.replace(pattern.search, pattern.replace);
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`   ✅ 已修复: ${filePath}`);
        totalChanges++;
      } else {
        console.log(`   ℹ️ 无需修改: ${filePath}`);
      }
      
    } catch (error) {
      console.log(`   ❌ 修复失败: ${filePath} - ${error.message}`);
    }
  }
  
  return totalChanges;
}

// 手动修复特定文件中的复杂逻辑
async function manualFixes() {
  console.log('\n🔧 执行手动修复...\n');
  
  const fixes = [
    {
      name: '修复streaming.ts中的复杂条件逻辑',
      file: 'src/transformers/streaming.ts',
      action: () => {
        const filePath = 'src/transformers/streaming.ts';
        if (!fs.existsSync(filePath)) return false;
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // 查找并替换复杂的条件逻辑
        const complexPattern = /\/\/ 只有在非tool_use场景才发送message_stop，工具调用需要保持对话开放[\s\S]*?const actualStopReason = stopReason \|\| 'tool_use';[\s\S]*?if \(actualStopReason !== 'tool_use'\) \{[\s\S]*?const messageStopEvent = this\.createAnthropicEvent\('message_stop', \{[\s\S]*?type: 'message_stop'[\s\S]*?\}\);[\s\S]*?if \(messageStopEvent\) \{[\s\S]*?yield messageStopEvent;[\s\S]*?\}[\s\S]*?\}[\s\S]*?\/\/ 不发送message_stop事件，避免会话终止/;
        
        if (complexPattern.test(content)) {
          content = content.replace(complexPattern, `// 🔧 修复：始终发送message_stop事件，不再根据工具调用状态过滤
        const messageStopEvent = this.createAnthropicEvent('message_stop', {
          type: 'message_stop'
        });
        if (messageStopEvent) {
          yield messageStopEvent;
        }`);
          
          fs.writeFileSync(filePath, content, 'utf8');
          return true;
        }
        return false;
      }
    },
    {
      name: '修复enhanced-client.ts中的多个条件发送点',
      file: 'src/providers/openai/enhanced-client.ts',
      action: () => {
        const filePath = 'src/providers/openai/enhanced-client.ts';
        if (!fs.existsSync(filePath)) return false;
        
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;
        
        // 修复第一个条件发送点
        const pattern1 = /\/\/ 只有非工具调用场景才发送message_stop[\s\S]*?if \(mappedStopReason !== 'tool_use'\) \{[\s\S]*?yield \{[\s\S]*?event: 'message_stop',[\s\S]*?data: \{ type: 'message_stop' \}[\s\S]*?\};[\s\S]*?\}/;
        if (pattern1.test(content)) {
          content = content.replace(pattern1, `// 🔧 修复：始终发送message_stop事件
                  yield {
                    event: 'message_stop',
                    data: { type: 'message_stop' }
                  };`);
          changed = true;
        }
        
        // 修复第二个条件发送点
        const pattern2 = /\/\/ 只有非工具调用场景才发送message_stop[\s\S]*?if \(finishReason !== 'tool_use'\) \{[\s\S]*?yield \{[\s\S]*?event: 'message_stop',[\s\S]*?data: \{ type: 'message_stop' \}[\s\S]*?\};[\s\S]*?\}/;
        if (pattern2.test(content)) {
          content = content.replace(pattern2, `// 🔧 修复：始终发送message_stop事件
          yield {
            event: 'message_stop',
            data: { type: 'message_stop' }
          };`);
          changed = true;
        }
        
        // 修复第三个条件发送点
        const pattern3 = /\/\/ 只有非工具调用场景才发送message_stop[\s\S]*?if \(finishReason !== 'tool_use'\) \{[\s\S]*?yield \{ event: 'message_stop', data: \{ type: 'message_stop' \} \};[\s\S]*?\}/;
        if (pattern3.test(content)) {
          content = content.replace(pattern3, `// 🔧 修复：始终发送message_stop事件
      yield { event: 'message_stop', data: { type: 'message_stop' } };`);
          changed = true;
        }
        
        if (changed) {
          fs.writeFileSync(filePath, content, 'utf8');
        }
        return changed;
      }
    }
  ];
  
  let manualChanges = 0;
  for (const fix of fixes) {
    console.log(`🔧 ${fix.name}`);
    try {
      if (fix.action()) {
        console.log(`   ✅ 修复成功: ${fix.file}`);
        manualChanges++;
      } else {
        console.log(`   ℹ️ 无需修改: ${fix.file}`);
      }
    } catch (error) {
      console.log(`   ❌ 修复失败: ${fix.file} - ${error.message}`);
    }
  }
  
  return manualChanges;
}

// 验证修复结果
async function validateFixes() {
  console.log('\n🔍 验证修复结果...\n');
  
  const validationPatterns = [
    {
      name: '检查是否还有条件message_stop发送',
      pattern: /if\s*\([^}]*tool_use[^}]*\)\s*\{[\s\S]*?message_stop/g,
      shouldNotExist: true
    },
    {
      name: '检查是否还有"只有非工具调用场景才发送message_stop"注释',
      pattern: /只有非工具调用场景才发送message_stop/g,
      shouldNotExist: true
    },
    {
      name: '检查是否还有"不发送message_stop事件，避免会话终止"注释',
      pattern: /不发送message_stop事件，避免会话终止/g,
      shouldNotExist: true
    }
  ];
  
  let validationErrors = 0;
  
  for (const file of filesToFix) {
    if (!fs.existsSync(file)) continue;
    
    console.log(`📋 验证文件: ${file}`);
    const content = fs.readFileSync(file, 'utf8');
    
    for (const validation of validationPatterns) {
      const matches = content.match(validation.pattern);
      if (validation.shouldNotExist && matches) {
        console.log(`   ❌ ${validation.name}: 发现 ${matches.length} 个匹配项`);
        matches.forEach((match, index) => {
          console.log(`      ${index + 1}. ${match.substring(0, 100)}...`);
        });
        validationErrors++;
      } else if (!validation.shouldNotExist && !matches) {
        console.log(`   ❌ ${validation.name}: 未找到预期内容`);
        validationErrors++;
      } else {
        console.log(`   ✅ ${validation.name}: 验证通过`);
      }
    }
  }
  
  return validationErrors;
}

// 生成修复报告
function generateReport(totalChanges, manualChanges, validationErrors) {
  const report = `# 🗑️ message_stop过滤策略移除报告

## 📋 修复概述

根据用户要求，完全移除了过时的message_stop过滤策略，让message_stop事件始终正常发送。

## 🔧 修复统计

- **自动修复**: ${totalChanges} 个文件
- **手动修复**: ${manualChanges} 个文件  
- **验证错误**: ${validationErrors} 个

## 📝 修复内容

### 移除的过滤逻辑
1. **条件发送逻辑**: 移除了所有基于工具调用状态的message_stop条件发送
2. **过滤注释**: 移除了"只有非工具调用场景才发送message_stop"等过时注释
3. **避免终止逻辑**: 移除了"不发送message_stop事件，避免会话终止"的逻辑

### 修复的文件
${filesToFix.map(file => `- \`${file}\``).join('\n')}

## 🎯 修复后的行为

- ✅ message_stop事件始终正常发送
- ✅ 不再根据工具调用状态进行过滤
- ✅ 客户端能够正确接收到对话结束信号
- ✅ 工具调用场景下对话也能正常结束

## 🚀 部署建议

1. 重新构建项目: \`./install-local.sh\`
2. 重启3456端口服务
3. 测试工具调用场景下的对话结束行为
4. 验证客户端能够正确接收message_stop事件

---

**修复时间**: ${new Date().toISOString()}  
**修复状态**: ${validationErrors === 0 ? '✅ 成功' : '❌ 需要进一步修复'}
`;

  fs.writeFileSync('docs/message-stop-filter-removal-report.md', report);
  console.log('\n📄 修复报告已生成: docs/message-stop-filter-removal-report.md');
}

// 主执行函数
async function main() {
  try {
    console.log('🚀 开始移除过时的message_stop过滤策略...\n');
    
    // 执行自动修复
    const totalChanges = await removeMessageStopFilters();
    
    // 执行手动修复
    const manualChanges = await manualFixes();
    
    // 验证修复结果
    const validationErrors = await validateFixes();
    
    // 生成报告
    generateReport(totalChanges, manualChanges, validationErrors);
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 message_stop过滤策略移除完成');
    console.log('='.repeat(80));
    console.log(`📊 修复统计:`);
    console.log(`   • 自动修复: ${totalChanges} 个文件`);
    console.log(`   • 手动修复: ${manualChanges} 个文件`);
    console.log(`   • 验证错误: ${validationErrors} 个`);
    
    if (validationErrors === 0) {
      console.log('\n✅ 所有修复完成，message_stop事件现在始终正常发送！');
      console.log('🚀 建议重新构建项目并重启服务以应用修复。');
    } else {
      console.log('\n⚠️ 发现验证错误，可能需要手动检查和修复。');
    }
    
    process.exit(validationErrors === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 修复过程中发生错误:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { removeMessageStopFilters, manualFixes, validateFixes };