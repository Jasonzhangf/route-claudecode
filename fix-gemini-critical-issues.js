#!/usr/bin/env node

/**
 * 修复Gemini Provider的关键问题
 * 基于OpenAI Provider v2.8.0的零沉默失败原则
 * 消除静默失败、修复stop_reason处理、确保工具调用完整性
 */

const fs = require('fs');
const path = require('path');

const FIXES = [
  {
    name: '移除静默失败的fallback文本生成',
    file: 'src/providers/gemini/client.ts',
    issues: [
      {
        description: '移除空响应时的默认道歉文本 - 这是静默失败',
        search: `    // If no content found, add helpful default response instead of empty text
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: 'I apologize, but I cannot provide a response at the moment. This may be due to content filtering, API limitations, or quota restrictions. Please try rephrasing your question or try again later.'
      });
    }`,
        replace: `    // 🔧 Critical Fix: NO SILENT FAILURES - 空响应必须抛出错误
    if (content.length === 0) {
      throw new Error('Empty response from Gemini API - no content generated. This indicates an API issue or content filtering.');
    }`
      },
      {
        description: '移除另一处静默失败的fallback文本',
        search: `        if (isUserQuery) {
          content.push({
            type: 'text',
            text: 'I apologize, but I cannot provide a response at the moment. This may be due to content filtering, API limitations, or quota restrictions. Please try rephrasing your question or try again later.'
          });
        }
      } else {
        content.push({
          type: 'text',
          text: 'I apologize, but I cannot provide a response at the moment. This may be due to content filtering, API limitations, or quota restrictions. Please try rephrasing your question or try again later.'
        });
      }`,
        replace: `        throw new Error('No content generated from Gemini API response - possible content filtering or API issue');
      } else {
        throw new Error('No valid candidate in Gemini API response - API communication failure');
      }`
      }
    ]
  },
  {
    name: '修复mapFinishReason的fallback机制',
    file: 'src/providers/gemini/client.ts', 
    issues: [
      {
        description: '移除finish reason映射的fallback默认值',
        search: `    return mappedReason || 'end_turn';`,
        replace: `    // 🔧 Critical Fix: NO FALLBACK - 未知finish_reason必须抛出错误
    if (!mappedReason) {
      throw new Error(\`Unknown Gemini finish reason '\${finishReason}' - no mapping found. Available mappings: \${Object.keys(reasonMap).join(', ')}\`);
    }
    return mappedReason;`
      }
    ]
  },
  {
    name: '移除UNEXPECTED_TOOL_CALL的手动修复',
    file: 'src/providers/gemini/client.ts',
    issues: [
      {
        description: '移除UNEXPECTED_TOOL_CALL的特殊处理',
        search: `      // 🔧 Critical Fix: Handle tool call related finish reasons
      'UNEXPECTED_TOOL_CALL': 'tool_use',`,
        replace: `      // 🔧 Removed UNEXPECTED_TOOL_CALL mapping - should be handled properly by Gemini API`
      }
    ]
  },
  {
    name: '修复硬编码的finish_reason',
    file: 'src/providers/gemini/client.ts',
    issues: [
      {
        description: '修复流式响应中的硬编码stop finish_reason',
        search: `        finish_reason: 'stop'`,
        replace: `        finish_reason: this.mapFinishReason(candidate?.finishReason || 'STOP')`
      }
    ]
  },
  {
    name: '统一工具调用ID格式标准化',
    file: 'src/providers/gemini/client.ts',
    issues: [
      {
        description: '确保所有工具调用ID都使用toolu_前缀',
        search: `        const toolId = \`toolu_\${Date.now()}_\${toolCallIndex}\`;`,
        replace: `        // 🎯 统一工具ID格式 - 使用与OpenAI Provider相同的生成逻辑
        const toolId = \`toolu_\${Date.now()}_\${Math.random().toString(36).substr(2, 8)}\`;`
      }
    ]
  },
  {
    name: '移除extractToolInputFromMessage fallback',
    file: 'src/providers/gemini/client.ts',
    issues: [
      {
        description: '移除工具参数提取的fallback机制',
        search: `  /**
   * Extract tool input parameters from user message
   * This is a fallback when Gemini doesn't properly call tools
   */
  private extractToolInputFromMessage(userMessage: string, tool: any): any {`,
        replace: `  /**
   * 🔧 DEPRECATED: Removed fallback tool parameter extraction
   * If Gemini doesn't call tools properly, we should fail explicitly
   */
  private extractToolInputFromMessage(userMessage: string, tool: any): any {
    // 🔧 Critical Fix: NO FALLBACK - 如果Gemini不能正确调用工具，必须明确失败
    throw new Error('Tool parameter extraction fallback is disabled - Gemini must call tools properly or fail explicitly');`
      }
    ]
  }
];

class GeminiProviderFixer {
  constructor() {
    this.basePath = '/Users/fanzhang/Documents/github/claude-code-router';
    this.backupSuffix = `.backup-${Date.now()}`;
    this.appliedFixes = [];
    this.failedFixes = [];
  }

  async applyAllFixes() {
    console.log('🔧 开始修复Gemini Provider的关键问题...\n');
    console.log('📋 基于OpenAI Provider v2.8.0的零沉默失败原则');
    console.log('🎯 目标：消除所有静默失败和fallback机制\n');

    for (const fix of FIXES) {
      console.log(`📦 应用修复: ${fix.name}`);
      await this.applyFix(fix);
      console.log('');
    }

    this.printSummary();
    return this.failedFixes.length === 0;
  }

  async applyFix(fix) {
    const filePath = path.join(this.basePath, fix.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`   ❌ 文件不存在: ${fix.file}`);
      this.failedFixes.push({ fix: fix.name, reason: 'File not found' });
      return;
    }

    // 备份原文件
    const backupPath = filePath + this.backupSuffix;
    fs.copyFileSync(filePath, backupPath);

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let appliedIssues = 0;

    for (const issue of fix.issues) {
      if (content.includes(issue.search)) {
        content = content.replace(issue.search, issue.replace);
        modified = true;
        appliedIssues++;
        console.log(`   ✅ ${issue.description}`);
      } else {
        console.log(`   ⚠️  找不到目标代码: ${issue.description}`);
        console.log(`      搜索: ${issue.search.substring(0, 60)}...`);
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`   📝 已更新文件: ${fix.file} (${appliedIssues}/${fix.issues.length} 个修复)`);
      this.appliedFixes.push({ fix: fix.name, issues: appliedIssues });
    } else {
      console.log(`   ⚠️  未找到任何目标代码段`);
      // 恢复备份
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
      this.failedFixes.push({ fix: fix.name, reason: 'No target code found' });
    }
  }

  printSummary() {
    console.log('='.repeat(60));
    console.log('📊 Gemini Provider修复总结');
    console.log('='.repeat(60));
    console.log(`✅ 成功应用: ${this.appliedFixes.length} 个修复`);
    console.log(`❌ 失败: ${this.failedFixes.length} 个修复`);

    if (this.appliedFixes.length > 0) {
      console.log('\n🎉 成功应用的修复:');
      this.appliedFixes.forEach((fix, index) => {
        console.log(`${index + 1}. ${fix.fix} (${fix.issues} 个问题)`);
      });
    }

    if (this.failedFixes.length > 0) {
      console.log('\n⚠️  失败的修复:');
      this.failedFixes.forEach((fix, index) => {
        console.log(`${index + 1}. ${fix.fix} - ${fix.reason}`);
      });
    }

    console.log('\n📋 后续步骤:');
    console.log('1. 运行 ./build.sh 验证修复');
    console.log('2. 运行 ./test-gemini-tool-call-coverage.js 进行完整测试');
    console.log('3. 检查5502端口的Gemini服务功能');

    if (this.appliedFixes.length > 0) {
      console.log('\n🔧 关键修复摘要:');
      console.log('- 🚫 移除所有静默失败的fallback文本生成');
      console.log('- 🎯 finish_reason映射失败时强制抛出错误');
      console.log('- ♻️  统一工具调用ID生成逻辑');
      console.log('- 🔥 移除UNEXPECTED_TOOL_CALL等不可靠的修复机制');
      console.log('- 💎 确保与OpenAI Provider相同的错误处理严格性');
    }
  }
}

// 运行修复
async function main() {
  const fixer = new GeminiProviderFixer();
  const success = await fixer.applyAllFixes();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GeminiProviderFixer, FIXES };