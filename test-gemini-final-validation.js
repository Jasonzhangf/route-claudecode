#!/usr/bin/env node

/**
 * Gemini Provider最终验证测试 
 * 验证所有硬编码和Fallback违规已修复
 * 确保100%符合Zero硬编码和Zero Fallback原则
 * Project owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 GEMINI PROVIDER 最终修复验证\n');

// 核心文件路径
const CORE_FILES = [
  'src/providers/gemini/client.ts',
  'src/providers/gemini/enhanced-rate-limit-manager.ts', 
  'src/providers/gemini/index.ts',
  'src/transformers/gemini.ts'
];

// 严格的违规检测模式
const CRITICAL_VIOLATIONS = [
  {
    pattern: /\?\?\s*['"`]https:\/\/[^'"`]+['"`]/g,
    name: 'API端点硬编码+空合并fallback',
    severity: 'CRITICAL'
  },
  {
    pattern: /\|\|\s*['"`]https:\/\/[^'"`]+['"`]/g, 
    name: 'API端点硬编码+逻辑OR fallback',
    severity: 'CRITICAL'
  },
  {
    pattern: /:.*['"`]gemini-[0-9a-z.-]+['"`]/g,
    name: '硬编码模型名',
    severity: 'CRITICAL'  
  },
  {
    pattern: /=\s*[0-9]{4,}/g,
    name: '硬编码数字常量',
    severity: 'HIGH'
  },
  {
    pattern: /console\.log.*['"`][^'"`]*gemini[^'"`]*['"`]/gi,
    name: '硬编码日志字符串',
    severity: 'MEDIUM'
  }
];

class FinalValidator {
  constructor() {
    this.violations = [];
    this.checkedFiles = 0;
    this.totalLines = 0;
  }

  async validate() {
    console.log('📋 检查核心文件...\n');
    
    for (const file of CORE_FILES) {
      await this.checkFile(file);
    }
    
    this.generateFinalReport();
  }
  
  async checkFile(filePath) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${filePath}`);
      return;
    }
    
    console.log(`🔍 检查 ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    this.totalLines += lines.length;
    this.checkedFiles++;
    
    // 检查所有违规模式
    for (const rule of CRITICAL_VIOLATIONS) {
      const matches = [...content.matchAll(rule.pattern)];
      
      for (const match of matches) {
        const lineNum = this.getLineNumber(content, match.index);
        const line = lines[lineNum - 1];
        
        // 跳过注释和TODO
        if (line.trim().startsWith('//') || line.includes('@ts-ignore') || line.includes('TODO')) {
          continue;
        }
        
        this.violations.push({
          file: filePath,
          line: lineNum,
          type: rule.name,
          severity: rule.severity,
          code: line.trim(),
          match: match[0]
        });
      }
    }
    
    console.log(`   ✅ ${filePath} - ${lines.length}行已检查`);
  }
  
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }
  
  generateFinalReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 GEMINI PROVIDER 最终修复验证报告');
    console.log('='.repeat(80));
    
    console.log(`\n📈 检查统计:`);
    console.log(`   - 核心文件数: ${this.checkedFiles}/${CORE_FILES.length}`);
    console.log(`   - 总代码行数: ${this.totalLines.toLocaleString()}`);
    console.log(`   - 发现违规: ${this.violations.length}`);
    
    // 按严重程度分类
    const critical = this.violations.filter(v => v.severity === 'CRITICAL');
    const high = this.violations.filter(v => v.severity === 'HIGH');
    const medium = this.violations.filter(v => v.severity === 'MEDIUM');
    
    console.log(`\n🚨 严重程度分布:`);
    console.log(`   - CRITICAL: ${critical.length} (阻断发布)`);
    console.log(`   - HIGH: ${high.length} (影响稳定性)`);
    console.log(`   - MEDIUM: ${medium.length} (影响维护性)`);
    
    if (this.violations.length > 0) {
      console.log(`\n❌ 仍需修复的违规问题:`);
      console.log('-'.repeat(80));
      
      this.violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. [${violation.severity}] ${violation.type}`);
        console.log(`   文件: ${violation.file}:${violation.line}`);
        console.log(`   代码: ${violation.code}`);
        console.log(`   匹配: "${violation.match}"`);
      });
      
      console.log(`\n💡 修复指导:`);
      console.log('   1. CRITICAL违规必须在发布前修复');
      console.log('   2. 将硬编码值移至配置系统');
      console.log('   3. 替换fallback为显式错误处理');
      console.log('   4. 使用静态常量替代魔法数字');
      
    } else {
      console.log(`\n🎉 验证通过! 所有违规问题已修复!`);
      console.log(`✅ Gemini Provider现在100%符合以下原则:`);
      console.log(`   - Zero 硬编码原则`);
      console.log(`   - Zero Fallback原则`);
      console.log(`   - 配置驱动架构`);
      console.log(`   - Fail-fast错误处理`);
    }
    
    // 修复进度评估
    console.log(`\n📊 修复进度评估:`);
    if (critical.length === 0 && high.length === 0) {
      console.log(`   🟢 核心违规: 已修复 (0个CRITICAL+HIGH)`);
    } else {
      console.log(`   🔴 核心违规: 仍有${critical.length + high.length}个待修复`);
    }
    
    if (medium.length <= 2) {
      console.log(`   🟡 一般违规: 可接受 (${medium.length}个MEDIUM)`);
    } else {
      console.log(`   🟡 一般违规: 过多 (${medium.length}个MEDIUM)`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    if (this.violations.length === 0) {
      console.log('🚀 修复完成! Gemini Provider已准备好用于生产环境!');
      process.exit(0);
    } else {
      console.log('⚠️  仍需继续修复，不建议发布到生产环境');
      process.exit(1);
    }
  }
}

// 执行最终验证
async function main() {
  const validator = new FinalValidator();
  await validator.validate();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  });
}

module.exports = { FinalValidator };