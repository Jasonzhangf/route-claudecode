#!/usr/bin/env node
/**
 * Gemini Provider Zero硬编码和Zero Fallback验证测试
 * 确保所有硬编码已移除，所有fallback机制已消除
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class GeminiZeroValidationTest {
  constructor() {
    this.testResults = {
      hardcodeViolations: [],
      fallbackViolations: [],
      configurationIssues: [],
      passed: 0,
      failed: 0
    };
    this.geminiFiles = [
      'src/providers/gemini/client.ts',
      'src/providers/gemini/enhanced-rate-limit-manager.ts', 
      'src/transformers/gemini.ts',
      'dist/providers/gemini/client.js',
      'dist/transformers/gemini.js'
    ];
  }

  async runTests() {
    console.log('🧪 开始Gemini Provider Zero硬编码和Zero Fallback验证测试...');
    console.log('📋 验证文件:', this.geminiFiles.join(', '));
    
    try {
      await this.testHardcodingViolations();
      await this.testFallbackMechanisms();
      await this.testConfigurationDriven();
      await this.testErrorHandling();
      await this.generateReport();
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
      this.failed++;
    }
  }

  async testHardcodingViolations() {
    console.log('\n🔍 1. 检查硬编码违规...');
    
    const hardcodedPatterns = [
      // 硬编码模型名
      /gemini-[0-9.]+-(pro|flash)/g,
      /'gemini-[^']*'/g,
      /"gemini-[^"]*"/g,
      // 硬编码URL
      /https?:\/\/[^\s"']+/g,
      // 硬编码配置值
      /temperature:\s*[0-9.]+/g,
      /maxTokens?:\s*[0-9]+/g,
      /max_tokens?:\s*[0-9]+/g,
      // 硬编码默认值
      /\|\|\s*['"][^'"]*['"]/g,
      /\?\?\s*['"][^'"]*['"]/g
    ];

    for (const filePath of this.geminiFiles) {
      if (!fs.existsSync(filePath)) {
        console.log(`   ⚠️  文件不存在: ${filePath}`);
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const violations = [];
      
      hardcodedPatterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches) {
          violations.push({
            file: filePath,
            pattern: pattern.toString(),
            matches: matches,
            description: this.getPatternDescription(index)
          });
        }
      });

      if (violations.length > 0) {
        console.log(`   ❌ ${filePath}: 发现${violations.length}个硬编码违规`);
        this.testResults.hardcodeViolations.push(...violations);
        this.failed++;
      } else {
        console.log(`   ✅ ${filePath}: 无硬编码违规`);
        this.passed++;
      }
    }
  }

  async testFallbackMechanisms() {
    console.log('\n🔍 2. 检查Fallback机制违规...');
    
    const fallbackPatterns = [
      // Fallback操作符
      /\|\|\s*(?!null|undefined|false|0|''|"")[^;\n}]+/g,
      /\?\?\s*(?!null|undefined)[^;\n}]+/g,
      // Try-catch fallback
      /catch.*\{[^}]*(?:return|=)\s*[^;}]+[;}]/g,
      // 默认配置fallback
      /default[A-Z][a-zA-Z]*Config/g,
      // 备用值设置
      /fallback|backup|alternative|default.*value/ig
    ];

    for (const filePath of this.geminiFiles) {
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const violations = [];
      
      fallbackPatterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches) {
          violations.push({
            file: filePath,
            pattern: pattern.toString(),
            matches: matches,
            description: this.getFallbackDescription(index)
          });
        }
      });

      if (violations.length > 0) {
        console.log(`   ❌ ${filePath}: 发现${violations.length}个Fallback机制违规`);
        this.testResults.fallbackViolations.push(...violations);
        this.failed++;
      } else {
        console.log(`   ✅ ${filePath}: 无Fallback机制违规`);
        this.passed++;
      }
    }
  }

  async testConfigurationDriven() {
    console.log('\n🔍 3. 验证配置驱动特性...');
    
    const configRequirements = [
      {
        description: '检查配置参数传递',
        test: (content) => content.includes('config.') && content.includes('this.config')
      },
      {
        description: '检查运行时可配置性',
        test: (content) => /constructor\s*\([^)]*config[^)]*\)/g.test(content)
      },
      {
        description: '检查无硬编码模型名',
        test: (content) => !/(gemini-[0-9.]+-(pro|flash))/g.test(content) || content.includes('this.config.model')
      }
    ];

    for (const filePath of this.geminiFiles) {
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      let passed = 0;
      let total = configRequirements.length;
      
      configRequirements.forEach(req => {
        if (req.test(content)) {
          passed++;
        } else {
          this.testResults.configurationIssues.push({
            file: filePath,
            requirement: req.description,
            status: 'failed'
          });
        }
      });

      if (passed === total) {
        console.log(`   ✅ ${filePath}: 配置驱动特性正确实现 (${passed}/${total})`);
        this.passed++;
      } else {
        console.log(`   ❌ ${filePath}: 配置驱动特性不完整 (${passed}/${total})`);
        this.failed++;
      }
    }
  }

  async testErrorHandling() {
    console.log('\n🔍 4. 验证Fail-Fast错误处理...');
    
    const errorPatterns = [
      {
        description: '检查异常直接抛出',
        pattern: /throw\s+new\s+Error/g,
        required: true
      },
      {
        description: '检查无默认值降级',
        pattern: /catch.*return.*default/ig,
        required: false // 不应该存在
      },
      {
        description: '检查参数验证',
        pattern: /if\s*\(!.*\)\s*{[^}]*throw/g,
        required: true
      }
    ];

    for (const filePath of this.geminiFiles) {
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      let errorHandlingScore = 0;
      
      errorPatterns.forEach(pattern => {
        const matches = content.match(pattern.pattern);
        const hasMatches = matches && matches.length > 0;
        
        if (pattern.required && hasMatches) {
          errorHandlingScore++;
          console.log(`   ✅ ${filePath}: ${pattern.description} - 正确实现`);
        } else if (!pattern.required && !hasMatches) {
          errorHandlingScore++;
          console.log(`   ✅ ${filePath}: ${pattern.description} - 正确避免`);
        } else {
          console.log(`   ❌ ${filePath}: ${pattern.description} - 实现不当`);
        }
      });

      if (errorHandlingScore === errorPatterns.length) {
        this.passed++;
      } else {
        this.failed++;
      }
    }
  }

  getPatternDescription(index) {
    const descriptions = [
      '硬编码Gemini模型名称',
      '硬编码模型名称（单引号）', 
      '硬编码模型名称（双引号）',
      '硬编码URL地址',
      '硬编码temperature值',
      '硬编码maxTokens值',
      '硬编码max_tokens值',
      '逻辑OR默认值',
      '空合并默认值'
    ];
    return descriptions[index] || '未知硬编码模式';
  }

  getFallbackDescription(index) {
    const descriptions = [
      '逻辑OR fallback机制',
      '空合并fallback机制', 
      'Try-catch fallback返回',
      '默认配置fallback',
      'Fallback关键词使用'
    ];
    return descriptions[index] || '未知fallback模式';
  }

  async generateReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `/tmp/gemini-zero-validation-${timestamp}.json`;
    const logPath = `/tmp/gemini-zero-validation-${timestamp}.log`;

    const report = {
      timestamp: new Date().toISOString(),
      testType: 'Zero硬编码和Zero Fallback验证',
      summary: {
        totalTests: this.passed + this.failed,
        passed: this.passed,
        failed: this.failed,
        passRate: `${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`
      },
      violations: {
        hardcodeViolations: this.testResults.hardcodeViolations.length,
        fallbackViolations: this.testResults.fallbackViolations.length,
        configurationIssues: this.testResults.configurationIssues.length
      },
      details: this.testResults,
      recommendation: this.generateRecommendations()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 Gemini Provider Zero违规验证测试报告');
    console.log('='.repeat(80));
    console.log(`📊 总体结果:`);
    console.log(`   • 总测试数: ${report.summary.totalTests}`);
    console.log(`   • 通过: ${report.summary.passed}`);
    console.log(`   • 失败: ${report.summary.failed}`);
    console.log(`   • 通过率: ${report.summary.passRate}`);
    
    console.log('\n📋 违规统计:');
    console.log(`   • 硬编码违规: ${report.violations.hardcodeViolations}`);
    console.log(`   • Fallback违规: ${report.violations.fallbackViolations}`);
    console.log(`   • 配置问题: ${report.violations.configurationIssues}`);
    
    if (report.violations.hardcodeViolations > 0) {
      console.log('\n❌ 硬编码违规详情:');
      this.testResults.hardcodeViolations.forEach((violation, i) => {
        console.log(`   ${i+1}. ${violation.description}`);
        console.log(`      文件: ${violation.file}`);
        console.log(`      匹配: ${violation.matches.slice(0, 3).join(', ')}${violation.matches.length > 3 ? '...' : ''}`);
      });
    }
    
    if (report.violations.fallbackViolations > 0) {
      console.log('\n❌ Fallback违规详情:');
      this.testResults.fallbackViolations.forEach((violation, i) => {
        console.log(`   ${i+1}. ${violation.description}`);
        console.log(`      文件: ${violation.file}`);
        console.log(`      匹配: ${violation.matches.slice(0, 2).join(', ')}${violation.matches.length > 2 ? '...' : ''}`);
      });
    }
    
    console.log('\n🎯 建议:');
    report.recommendation.forEach(rec => {
      console.log(`   ${rec.priority === 'high' ? '❌' : rec.priority === 'medium' ? '⚠️' : 'ℹ️'} ${rec.message}`);
    });
    
    console.log('\n📝 详细报告已保存到:');
    console.log(`   ${reportPath}`);
    console.log('='.repeat(80));
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.testResults.hardcodeViolations.length > 0) {
      recommendations.push({
        priority: 'high',
        message: `发现${this.testResults.hardcodeViolations.length}个硬编码违规，需要立即修复`
      });
    }
    
    if (this.testResults.fallbackViolations.length > 0) {
      recommendations.push({
        priority: 'high', 
        message: `发现${this.testResults.fallbackViolations.length}个Fallback机制，违反Zero Fallback原则`
      });
    }
    
    if (this.testResults.configurationIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        message: `配置驱动特性需要完善，${this.testResults.configurationIssues.length}个问题需要修复`
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'info',
        message: '所有检查通过，Gemini Provider符合Zero硬编码和Zero Fallback原则'
      });
    }
    
    return recommendations;
  }
}

// 执行测试
if (require.main === module) {
  const test = new GeminiZeroValidationTest();
  test.runTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = GeminiZeroValidationTest;
