#!/usr/bin/env node

/**
 * Gemini Provider硬编码和Fallback违规修复验证测试
 * 验证修复后的代码完全符合Zero硬编码和Zero Fallback原则
 * Project owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 测试配置
const GEMINI_PROVIDER_PATH = 'src/providers/gemini';
const GEMINI_TRANSFORMER_PATH = 'src/transformers/gemini.ts';

// 硬编码检测规则
const HARDCODE_PATTERNS = [
  // API端点硬编码
  {
    pattern: /https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    description: '硬编码API端点',
    severity: 'CRITICAL'
  },
  // 模型名称硬编码
  {
    pattern: /'gemini-[0-9.a-z-]+'/gi,
    description: '硬编码模型名称',
    severity: 'CRITICAL'
  },
  // Provider类型硬编码
  {
    pattern: /:\s*'gemini'/g,
    description: '硬编码provider类型',
    severity: 'HIGH'
  },
  // 魔法数字
  {
    pattern: /\b(3000|30000|60000|429|502|503|504)\b/g,
    description: '魔法数字',
    severity: 'MEDIUM'
  },
  // ID生成硬编码
  {
    pattern: /`(msg_|toolu_)[^`]+`/g,
    description: '硬编码ID生成模式',
    severity: 'HIGH'
  }
];

// Fallback检测规则
const FALLBACK_PATTERNS = [
  // 逻辑OR fallback
  {
    pattern: /\|\|\s*['"`][^'"`]+['"`]/g,
    description: '逻辑OR fallback到硬编码值',
    severity: 'CRITICAL'
  },
  // 空合并fallback
  {
    pattern: /\?\?\s*['"`][^'"`]+['"`]/g,
    description: '空合并fallback到硬编码值',
    severity: 'CRITICAL'
  },
  // Try-catch silent fallback
  {
    pattern: /catch[^}]*return\s*[^;]+;/g,
    description: 'Try-catch静默fallback',
    severity: 'HIGH'
  },
  // 默认参数fallback
  {
    pattern: /=\s*['"`][^'"`]+['"`]/g,
    description: '默认参数fallback',
    severity: 'MEDIUM'
  }
];

class HardcodeFallbackValidator {
  constructor() {
    this.violations = [];
    this.totalFiles = 0;
    this.checkedFiles = 0;
  }

  /**
   * 执行完整验证
   */
  async runFullValidation() {
    console.log('🔍 开始Gemini Provider硬编码和Fallback违规验证...\n');

    // 1. 扫描所有Gemini相关文件
    const filesToCheck = await this.collectGeminiFiles();
    this.totalFiles = filesToCheck.length;
    
    console.log(`📂 发现${this.totalFiles}个待检查文件:`);
    filesToCheck.forEach(file => console.log(`   ${file}`));
    console.log('');

    // 2. 逐一检查每个文件
    for (const file of filesToCheck) {
      await this.validateFile(file);
      this.checkedFiles++;
    }

    // 3. 生成报告
    this.generateReport();
  }

  /**
   * 收集所有Gemini相关文件
   */
  async collectGeminiFiles() {
    const files = [];
    
    // 扫描Gemini Provider目录
    if (fs.existsSync(GEMINI_PROVIDER_PATH)) {
      const providerFiles = this.scanDirectory(GEMINI_PROVIDER_PATH, '.ts');
      files.push(...providerFiles);
    }
    
    // 添加Gemini转换器
    if (fs.existsSync(GEMINI_TRANSFORMER_PATH)) {
      files.push(GEMINI_TRANSFORMER_PATH);
    }

    return files;
  }

  /**
   * 递归扫描目录
   */
  scanDirectory(dirPath, extension) {
    const files = [];
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.scanDirectory(fullPath, extension));
        } else if (stat.isFile() && fullPath.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️  扫描目录失败: ${dirPath} - ${error.message}`);
    }
    
    return files;
  }

  /**
   * 验证单个文件
   */
  async validateFile(filePath) {
    console.log(`🔍 检查文件: ${filePath}`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // 检查硬编码违规
      this.checkHardcodeViolations(filePath, content, lines);
      
      // 检查Fallback违规
      this.checkFallbackViolations(filePath, content, lines);
      
      console.log(`   ✅ ${filePath} 检查完成`);
    } catch (error) {
      console.error(`   ❌ ${filePath} 检查失败: ${error.message}`);
    }
  }

  /**
   * 检查硬编码违规
   */
  checkHardcodeViolations(filePath, content, lines) {
    for (const rule of HARDCODE_PATTERNS) {
      const matches = [...content.matchAll(rule.pattern)];
      
      for (const match of matches) {
        const lineNumber = this.findLineNumber(content, match.index);
        const line = lines[lineNumber - 1];
        
        // 跳过注释中的匹配
        if (this.isInComment(line, match.index)) {
          continue;
        }
        
        this.violations.push({
          type: 'HARDCODE',
          severity: rule.severity,
          file: filePath,
          line: lineNumber,
          description: rule.description,
          code: line.trim(),
          match: match[0]
        });
      }
    }
  }

  /**
   * 检查Fallback违规
   */
  checkFallbackViolations(filePath, content, lines) {
    for (const rule of FALLBACK_PATTERNS) {
      const matches = [...content.matchAll(rule.pattern)];
      
      for (const match of matches) {
        const lineNumber = this.findLineNumber(content, match.index);
        const line = lines[lineNumber - 1];
        
        // 跳过注释中的匹配
        if (this.isInComment(line, match.index)) {
          continue;
        }
        
        this.violations.push({
          type: 'FALLBACK',
          severity: rule.severity,
          file: filePath,
          line: lineNumber,
          description: rule.description,
          code: line.trim(),
          match: match[0]
        });
      }
    }
  }

  /**
   * 查找行号
   */
  findLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * 检查是否在注释中
   */
  isInComment(line, matchIndex) {
    const commentIndex = line.indexOf('//');
    return commentIndex !== -1 && commentIndex < matchIndex;
  }

  /**
   * 生成验证报告
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 GEMINI PROVIDER 硬编码和FALLBACK违规验证报告');
    console.log('='.repeat(80));
    
    console.log(`📊 检查统计:`);
    console.log(`   - 总文件数: ${this.totalFiles}`);
    console.log(`   - 已检查: ${this.checkedFiles}`);
    console.log(`   - 总违规数: ${this.violations.length}`);
    
    // 按类型分组统计
    const hardcodeViolations = this.violations.filter(v => v.type === 'HARDCODE');
    const fallbackViolations = this.violations.filter(v => v.type === 'FALLBACK');
    
    console.log(`   - 硬编码违规: ${hardcodeViolations.length}`);
    console.log(`   - Fallback违规: ${fallbackViolations.length}`);
    
    // 按严重程度统计
    const criticalViolations = this.violations.filter(v => v.severity === 'CRITICAL');
    const highViolations = this.violations.filter(v => v.severity === 'HIGH');
    const mediumViolations = this.violations.filter(v => v.severity === 'MEDIUM');
    
    console.log(`\n🚨 按严重程度分类:`);
    console.log(`   - CRITICAL: ${criticalViolations.length}`);
    console.log(`   - HIGH: ${highViolations.length}`);
    console.log(`   - MEDIUM: ${mediumViolations.length}`);

    // 详细违规报告
    if (this.violations.length > 0) {
      console.log('\n❌ 发现的违规问题:');
      console.log('-'.repeat(80));
      
      // 按文件分组显示
      const violationsByFile = this.groupViolationsByFile();
      
      for (const [file, violations] of Object.entries(violationsByFile)) {
        console.log(`\n📁 ${file} (${violations.length}个违规):`);
        
        violations.forEach((violation, index) => {
          console.log(`   ${index + 1}. [${violation.severity}] ${violation.description}`);
          console.log(`      行${violation.line}: ${violation.code}`);
          console.log(`      匹配: "${violation.match}"`);
        });
      }
      
      // 修复建议
      console.log('\n💡 修复建议:');
      console.log('-'.repeat(80));
      this.generateFixSuggestions();
      
    } else {
      console.log('\n✅ 恭喜! 没有发现硬编码或Fallback违规问题!');
      console.log('   Gemini Provider完全符合Zero硬编码和Zero Fallback原则');
    }

    // 最终结果
    console.log('\n' + '='.repeat(80));
    if (this.violations.length === 0) {
      console.log('🎉 验证通过! Gemini Provider修复完成!');
      console.log('✅ 100%符合Claude Code Router核心原则');
      process.exit(0);
    } else {
      console.log('❌ 验证失败! 仍有违规问题需要修复');
      console.log(`📊 违规统计: ${hardcodeViolations.length}个硬编码 + ${fallbackViolations.length}个Fallback`);
      process.exit(1);
    }
  }

  /**
   * 按文件分组违规
   */
  groupViolationsByFile() {
    const groups = {};
    
    this.violations.forEach(violation => {
      if (!groups[violation.file]) {
        groups[violation.file] = [];
      }
      groups[violation.file].push(violation);
    });
    
    return groups;
  }

  /**
   * 生成修复建议
   */
  generateFixSuggestions() {
    const suggestions = [
      '1. 硬编码API端点 → 从config.endpoint获取，缺失时抛错',
      '2. 硬编码模型名 → 从参数传递，使用配置化模式验证',
      '3. 硬编码Provider类型 → 使用静态常量或配置',
      '4. 魔法数字 → 定义为常量并添加配置化注释',
      '5. 逻辑OR/空合并fallback → 改为显式null检查和错误抛出',
      '6. Try-catch fallback → 移除默认返回，让错误向上传播',
      '7. ID生成模式 → 提取为可配置的方法'
    ];
    
    suggestions.forEach(suggestion => {
      console.log(`   ${suggestion}`);
    });
  }
}

// 执行验证
async function main() {
  const validator = new HardcodeFallbackValidator();
  await validator.runFullValidation();
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 验证执行失败:', error);
    process.exit(1);
  });
}

module.exports = { HardcodeFallbackValidator };