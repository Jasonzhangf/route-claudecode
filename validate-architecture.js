/**
 * 架构合规性验证脚本
 * 
 * 简化版JavaScript实现，用于快速检查架构违规问题
 */

const fs = require('fs');
const path = require('path');

// 模块依赖关系图
const MODULE_DEPENDENCY_GRAPH = {
  client: ['router', 'server'],
  router: ['pipeline', 'debug'],
  pipeline: ['debug'],
  debug: [],
  server: ['pipeline', 'debug']
};

class SimpleArchitectureValidator {
  constructor(srcDir = './src') {
    this.srcDir = path.resolve(srcDir);
    this.violations = [];
  }

  async validate() {
    console.log('🔍 开始简化架构验证...');
    
    this.violations = [];
    
    // 检查跨模块导入
    await this.checkCrossModuleImports();
    
    // 打印结果
    this.printResults();
    
    return {
      success: this.violations.filter(v => v.severity === 'error').length === 0,
      violations: this.violations
    };
  }

  async checkCrossModuleImports() {
    const moduleDirectories = [
      'client', 'router', 'pipeline', 'debug', 'server',
      'interfaces', 'middleware', 'modules', 'routes', 'cli'
    ];

    for (const moduleDir of moduleDirectories) {
      const modulePath = path.join(this.srcDir, moduleDir);
      if (fs.existsSync(modulePath)) {
        await this.scanModuleFiles(moduleDir, modulePath);
      }
    }
  }

  async scanModuleFiles(moduleName, modulePath) {
    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          this.analyzeFile(moduleName, fullPath);
        }
      }
    };

    scanDir(modulePath);
  }

  analyzeFile(moduleName, filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const importMatch = line.match(/^import\s+.*\s+from\s+['"]([^'"]+)['"]/);
        
        if (importMatch && importMatch[1]) {
          const source = importMatch[1];
          
          // 检查跨模块导入
          if (source.startsWith('../')) {
            const targetModule = this.getTargetModule(source, filePath);
            if (targetModule && targetModule !== moduleName) {
              this.checkModuleDependency(moduleName, targetModule, filePath, i + 1, source);
            }
          }
          
          // 检查直接实现导入
          if (this.isDirectImplementationImport(source)) {
            this.addViolation({
              type: 'DIRECT_IMPLEMENTATION_ACCESS',
              severity: 'error',
              file: path.relative(this.srcDir, filePath),
              line: i + 1,
              message: `直接导入具体实现: ${source}`,
              sourceModule: moduleName,
              suggestion: '请使用 src/interfaces/core 中的接口'
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  无法分析文件 ${filePath}: ${error.message}`);
    }
  }

  getTargetModule(source, filePath) {
    // 简单的目标模块推断
    const parts = source.split('/').filter(part => part !== '..' && part !== '.');
    if (parts.length > 0) {
      const firstPart = parts[0];
      
      // 常见模块映射
      const moduleMapping = {
        'server': 'server',
        'pipeline': 'pipeline', 
        'middleware': 'middleware',
        'modules': 'modules',
        'routes': 'routes',
        'interfaces': 'interfaces',
        'client': 'client',
        'router': 'router',
        'debug': 'debug',
        'cli': 'cli'
      };
      
      return moduleMapping[firstPart] || firstPart;
    }
    
    return null;
  }

  checkModuleDependency(sourceModule, targetModule, filePath, line, source) {
    // 检查是否允许该依赖
    const allowedDeps = MODULE_DEPENDENCY_GRAPH[sourceModule] || [];
    
    if (!allowedDeps.includes(targetModule) && targetModule !== 'interfaces') {
      this.addViolation({
        type: 'UNAUTHORIZED_DEPENDENCY',
        severity: 'error',
        file: path.relative(this.srcDir, filePath),
        line: line,
        message: `未授权的模块依赖: ${sourceModule} → ${targetModule}`,
        sourceModule: sourceModule,
        targetModule: targetModule,
        suggestion: `请通过允许的接口访问，或重新设计依赖关系`
      });
    }
  }

  isDirectImplementationImport(source) {
    const implementationPatterns = [
      /server\/.*\.ts$/,
      /middleware\/.*\.ts$/,
      /modules\/.*\.ts$/,
      /pipeline\/.*\.ts$/,
      /routes\/.*\.ts$/
    ];

    return implementationPatterns.some(pattern => pattern.test(source));
  }

  addViolation(violation) {
    this.violations.push(violation);
  }

  printResults() {
    const errorCount = this.violations.filter(v => v.severity === 'error').length;
    const warningCount = this.violations.filter(v => v.severity === 'warning').length;
    
    console.log('\n📊 架构验证结果:');
    console.log(`   总违规数: ${this.violations.length}`);
    console.log(`   错误: ${errorCount}`);
    console.log(`   警告: ${warningCount}`);

    if (this.violations.length > 0) {
      console.log('\n❌ 发现的主要问题:');
      
      // 按类型分组显示
      const groupedViolations = {};
      for (const violation of this.violations) {
        if (!groupedViolations[violation.type]) {
          groupedViolations[violation.type] = [];
        }
        groupedViolations[violation.type].push(violation);
      }

      for (const [type, violations] of Object.entries(groupedViolations)) {
        console.log(`\n   ${type} (${violations.length}个):`);
        violations.slice(0, 5).forEach(violation => {
          const severity = violation.severity === 'error' ? '🚫' : '⚠️';
          console.log(`     ${severity} ${violation.file}:${violation.line}`);
          console.log(`        ${violation.message}`);
          if (violation.suggestion) {
            console.log(`        💡 ${violation.suggestion}`);
          }
        });
        
        if (violations.length > 5) {
          console.log(`     ... 还有 ${violations.length - 5} 个同类问题`);
        }
      }
    } else {
      console.log('\n✅ 未发现架构违规问题！');
    }

    console.log('\n🎯 改进建议:');
    if (errorCount > 0) {
      console.log('   1. 立即修复所有错误级别的违规问题');
      console.log('   2. 使用 src/interfaces/core 中定义的标准接口');
      console.log('   3. 重构跨模块依赖，确保遵循依赖图规范');
    } else {
      console.log('   当前架构基本符合规范 ✨');
    }
  }
}

// 执行验证
async function runValidation() {
  const validator = new SimpleArchitectureValidator('./src');
  const result = await validator.validate();
  
  // 生成报告文件
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      success: result.success,
      totalViolations: result.violations.length,
      errorCount: result.violations.filter(v => v.severity === 'error').length,
      warningCount: result.violations.filter(v => v.severity === 'warning').length
    },
    violations: result.violations
  };

  fs.writeFileSync('./architecture-validation-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 详细报告已保存到: ./architecture-validation-report.json');
  
  process.exit(result.success ? 0 : 1);
}

runValidation().catch(error => {
  console.error('❌ 验证失败:', error);
  process.exit(1);
});