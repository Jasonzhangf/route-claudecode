#!/usr/bin/env node
/**
 * Clean Architecture Validation Script
 * 验证流水线架构是否符合单向依赖原则
 * Project owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// 定义层次依赖规则
const LAYER_RULES = {
  'providers': {
    name: 'Provider Layer',
    canImport: ['types', 'utils'],
    cannotImport: ['transformers', 'preprocessing', 'routing', 'input', 'output']
  },
  'transformers': {
    name: 'Transformer Layer', 
    canImport: ['types', 'utils'],
    cannotImport: ['providers', 'preprocessing', 'routing', 'input', 'output']
  },
  'preprocessing': {
    name: 'Preprocessing Layer',
    canImport: ['types', 'utils', 'transformers', 'patches'],
    cannotImport: ['providers', 'routing', 'input', 'output']
  },
  'routing': {
    name: 'Routing Layer',
    canImport: ['types', 'utils', 'preprocessing'],
    cannotImport: ['providers', 'transformers', 'input', 'output']
  },
  'input': {
    name: 'Input Layer',
    canImport: ['types', 'utils'],
    cannotImport: ['providers', 'transformers', 'preprocessing', 'routing', 'output']
  },
  'output': {
    name: 'Output Layer', 
    canImport: ['types', 'utils'],
    cannotImport: ['providers', 'transformers', 'preprocessing', 'routing', 'input']
  }
};

class ArchitectureValidator {
  constructor() {
    this.violations = [];
    this.circularDeps = [];
    this.srcPath = path.join(__dirname, 'src');
  }

  /**
   * 主要验证入口
   */
  async validate() {
    console.log('🏗️ Validating Clean Architecture...\n');

    // 1. 检查循环依赖
    this.checkCircularDependencies();

    // 2. 检查层次依赖违反
    this.checkLayerViolations();

    // 3. 检查特殊的跨层引用
    this.checkCrossLayerReferences();

    // 4. 输出结果
    this.reportResults();
  }

  /**
   * 检查循环依赖
   */
  checkCircularDependencies() {
    console.log('🔍 Checking for circular dependencies...');

    // 重点检查已知问题的文件
    const problemFiles = [
      'src/providers/gemini/client.ts',
      'src/transformers/gemini.ts',
      'src/preprocessing/gemini-patch-preprocessor.ts'
    ];

    for (const file of problemFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        this.checkFileForCircularDeps(file, content);
      }
    }
  }

  /**
   * 检查单个文件的循环依赖
   */
  checkFileForCircularDeps(fileName, content) {
    const imports = this.extractImports(content);
    
    // 检查Gemini Provider是否导入Transformer
    if (fileName.includes('providers/gemini/client.ts')) {
      const hasTransformerImport = imports.some(imp => 
        imp.includes('transformers/gemini') || 
        imp.includes('preprocessing/gemini')
      );
      
      if (hasTransformerImport) {
        this.violations.push({
          type: 'circular_dependency',
          file: fileName,
          issue: 'Provider imports Transformer - violates single direction dependency',
          severity: 'CRITICAL'
        });
      } else {
        console.log('✅ Gemini Provider: No circular dependencies detected');
      }
    }

    // 检查Transformer是否导入Provider特定逻辑
    if (fileName.includes('transformers/gemini.ts')) {
      const hasProviderSpecific = content.includes('createUnexpectedToolCallResponse') ||
                                   content.includes('ShuaiHong') ||
                                   content.includes('ModelScope') ||
                                   content.includes('LMStudio');
      
      if (hasProviderSpecific) {
        this.violations.push({
          type: 'service_specific_logic',
          file: fileName,
          issue: 'Transformer contains service-specific logic - should be moved to patches',
          severity: 'HIGH'
        });
      } else {
        console.log('✅ Gemini Transformer: Pure format converter confirmed');
      }
    }
  }

  /**
   * 检查层次依赖违反
   */
  checkLayerViolations() {
    console.log('\n🏛️ Checking layer dependency violations...');

    for (const [layerName, rules] of Object.entries(LAYER_RULES)) {
      const layerPath = path.join(this.srcPath, layerName);
      if (fs.existsSync(layerPath)) {
        this.checkLayerFiles(layerName, layerPath, rules);
      }
    }
  }

  /**
   * 检查特定层的所有文件
   */
  checkLayerFiles(layerName, layerPath, rules) {
    const files = this.getAllTSFiles(layerPath);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const imports = this.extractImports(content);
      
      for (const importPath of imports) {
        // 检查是否违反层次规则
        for (const forbiddenLayer of rules.cannotImport) {
          if (importPath.includes(`/${forbiddenLayer}/`) || importPath.includes(`${forbiddenLayer}`)) {
            this.violations.push({
              type: 'layer_violation',
              file: file.replace(__dirname + '/', ''),
              issue: `${rules.name} imports from ${forbiddenLayer} - violates layer dependency rules`,
              severity: 'HIGH',
              importPath
            });
          }
        }
      }
    }
  }

  /**
   * 检查特殊的跨层引用
   */
  checkCrossLayerReferences() {
    console.log('\n🔗 Checking cross-layer references...');

    // 检查是否有硬编码的服务名
    this.checkHardcodedServiceNames();
    
    // 检查是否有重复的修复逻辑
    this.checkDuplicateFixLogic();
  }

  /**
   * 检查硬编码服务名
   */
  checkHardcodedServiceNames() {
    const hardcodedPatterns = [
      'shuaihong',
      'modelscope', 
      'lmstudio',
      'openai-key',
      'provider-specific'
    ];

    const transformerFiles = this.getAllTSFiles(path.join(this.srcPath, 'transformers'));
    
    for (const file of transformerFiles) {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();
      
      for (const pattern of hardcodedPatterns) {
        if (content.includes(pattern)) {
          this.violations.push({
            type: 'hardcoding',
            file: file.replace(__dirname + '/', ''),
            issue: `Hardcoded service name '${pattern}' found in transformer`,
            severity: 'MEDIUM'
          });
        }
      }
    }
  }

  /**
   * 检查重复的修复逻辑
   */
  checkDuplicateFixLogic() {
    const fixPatterns = [
      'UNEXPECTED_TOOL_CALL',
      'createUnexpectedToolCallResponse', 
      'ShuaiHong.*patch',
      'ModelScope.*fix',
      'tool.*call.*detection'
    ];

    const allFiles = [
      ...this.getAllTSFiles(path.join(this.srcPath, 'transformers')),
      ...this.getAllTSFiles(path.join(this.srcPath, 'providers')),
      ...this.getAllTSFiles(path.join(this.srcPath, 'preprocessing'))
    ];

    const fixLocations = new Map();

    for (const pattern of fixPatterns) {
      const regex = new RegExp(pattern, 'gi');
      
      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const matches = content.match(regex);
        
        if (matches && matches.length > 0) {
          if (!fixLocations.has(pattern)) {
            fixLocations.set(pattern, []);
          }
          fixLocations.get(pattern).push({
            file: file.replace(__dirname + '/', ''),
            count: matches.length
          });
        }
      }
    }

    // 报告重复的修复逻辑
    for (const [pattern, locations] of fixLocations) {
      if (locations.length > 1) {
        this.violations.push({
          type: 'duplicate_logic',
          issue: `Fix pattern '${pattern}' found in multiple locations`,
          severity: 'MEDIUM',
          locations: locations.map(l => l.file)
        });
      }
    }
  }

  /**
   * 提取文件中的导入语句
   */
  extractImports(content) {
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * 获取目录下所有TypeScript文件
   */
  getAllTSFiles(dir) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllTSFiles(fullPath));
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * 输出验证结果
   */
  reportResults() {
    console.log('\n📊 Architecture Validation Results');
    console.log('=====================================\n');

    if (this.violations.length === 0) {
      console.log('🎉 All checks passed! Clean architecture validated successfully.\n');
      console.log('✅ No circular dependencies detected');
      console.log('✅ All layer dependency rules followed');  
      console.log('✅ No hardcoded service names in transformers');
      console.log('✅ No duplicate fix logic detected');
      return;
    }

    // 按严重程度分组
    const critical = this.violations.filter(v => v.severity === 'CRITICAL');
    const high = this.violations.filter(v => v.severity === 'HIGH');
    const medium = this.violations.filter(v => v.severity === 'MEDIUM');

    if (critical.length > 0) {
      console.log('🚨 CRITICAL VIOLATIONS:');
      critical.forEach(v => {
        console.log(`  ❌ ${v.file || 'Multiple files'}`);
        console.log(`     Issue: ${v.issue}`);
        if (v.locations) console.log(`     Locations: ${v.locations.join(', ')}`);
        console.log();
      });
    }

    if (high.length > 0) {
      console.log('⚠️ HIGH PRIORITY VIOLATIONS:');
      high.forEach(v => {
        console.log(`  🟠 ${v.file || 'Multiple files'}`);
        console.log(`     Issue: ${v.issue}`);
        if (v.locations) console.log(`     Locations: ${v.locations.join(', ')}`);
        console.log();
      });
    }

    if (medium.length > 0) {
      console.log('📋 MEDIUM PRIORITY VIOLATIONS:');
      medium.forEach(v => {
        console.log(`  🟡 ${v.file || 'Multiple files'}`);
        console.log(`     Issue: ${v.issue}`);
        if (v.locations) console.log(`     Locations: ${v.locations.join(', ')}`);
        console.log();
      });
    }

    console.log(`\nSummary: ${this.violations.length} violations found`);
    console.log(`Critical: ${critical.length}, High: ${high.length}, Medium: ${medium.length}`);
    
    if (critical.length > 0 || high.length > 0) {
      console.log('\n⚡ Action Required: Fix critical and high priority violations immediately.');
      process.exit(1);
    } else {
      console.log('\n✅ Architecture is acceptable. Consider addressing medium priority issues.');
    }
  }
}

// 运行验证
const validator = new ArchitectureValidator();
validator.validate().catch(console.error);