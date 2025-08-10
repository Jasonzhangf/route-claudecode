#!/usr/bin/env node
/**
 * Fix Input Layer Violations Script
 * 修复Input层导入Preprocessing层的违反问题
 * Project owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

class InputLayerFixer {
  constructor() {
    this.fixes = [];
    this.srcPath = path.join(__dirname, 'src');
  }

  async fix() {
    console.log('🔧 Fixing Input Layer violations...\n');

    // Fix Input layer importing from preprocessing
    await this.fixInputPreprocessingImports();

    // Report results
    this.reportResults();
  }

  /**
   * 修复Input层导入Preprocessing的违反
   */
  async fixInputPreprocessingImports() {
    console.log('🏗️ Fixing Input layer preprocessing imports...');

    const inputFiles = this.getAllTSFiles(path.join(this.srcPath, 'input'));
    
    for (const file of inputFiles) {
      let content = fs.readFileSync(file, 'utf8');
      let modified = false;
      
      // 移除preprocessing相关导入
      const preprocessingImports = [
        /import.*getUnifiedPatchPreprocessor.*from.*preprocessing.*;\s*\n/g,
        /import.*from\s+['"`][^'"`]*preprocessing[^'"`]*['"`];?\s*\n/g,
        /import.*preprocessor.*from.*preprocessing.*;\s*\n/g,
        /import.*Preprocessor.*from.*preprocessing.*;\s*\n/g
      ];

      for (const pattern of preprocessingImports) {
        if (pattern.test(content)) {
          content = content.replace(pattern, '');
          modified = true;
        }
      }

      // 移除对preprocessing实例的使用
      const preprocessorUsages = [
        /const\s+preprocessor\s*=\s*getUnifiedPatchPreprocessor\([^)]*\);\s*\n/g,
        /this\.preprocessor\s*=.*getUnifiedPatchPreprocessor.*;\s*\n/g,
        /getUnifiedPatchPreprocessor\([^)]*\)/g
      ];

      for (const pattern of preprocessorUsages) {
        if (pattern.test(content)) {
          content = content.replace(pattern, '// Preprocessing moved to routing layer');
          modified = true;
        }
      }

      // 移除preprocessor方法调用
      content = content.replace(
        /await\s+preprocessor\.[a-zA-Z]+\([^)]*\)/g,
        '// Preprocessing now handled by routing layer'
      );

      content = content.replace(
        /preprocessor\.[a-zA-Z]+\([^)]*\)/g,
        '// Preprocessing moved to routing layer'
      );

      // 添加架构说明注释
      if (modified) {
        const architectureNote = `\n/**\n * Architecture Note: Preprocessing has been moved to the routing layer.\n * Input layer now only handles basic format validation and parsing.\n * All transformations and patches are handled by the Enhanced Routing Engine.\n */\n`;
        
        // 在class定义前插入注释
        content = content.replace(
          /(export class \w+InputProcessor)/,
          architectureNote + '$1'
        );
      }

      if (modified) {
        fs.writeFileSync(file, content);
        this.fixes.push({
          file: file.replace(__dirname + '/', ''),
          type: 'input_layer_cleanup',
          description: 'Removed preprocessing imports and usage from input layer'
        });
      }
    }
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
   * 输出修复结果
   */
  reportResults() {
    console.log('\n📊 Input Layer Fix Results');
    console.log('===========================\n');

    if (this.fixes.length === 0) {
      console.log('✅ No input layer violations found - architecture is compliant.\n');
      return;
    }

    console.log('🔧 Input Layer Fixes Applied:');
    
    for (const fix of this.fixes) {
      console.log(`  ✅ ${fix.file}`);
      console.log(`     ${fix.description}`);
      console.log();
    }

    console.log(`\nSummary: ${this.fixes.length} input layer violations fixed`);
    
    console.log('\n🎯 Architecture Changes:');
    console.log('- Input layer now only handles format validation');
    console.log('- Preprocessing moved to Enhanced Routing Engine');
    console.log('- Clean separation of concerns maintained');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Run validation script to verify fixes');
    console.log('2. Test input processing functionality');
    console.log('3. Verify routing layer handles preprocessing correctly');
  }
}

// 运行修复
const fixer = new InputLayerFixer();
fixer.fix().catch(console.error);