#!/usr/bin/env node
/**
 * Architecture Violations Auto-Fix Script
 * 自动修复流水线架构违反问题
 * Project owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

class ArchitectureFixer {
  constructor() {
    this.fixes = [];
    this.srcPath = path.join(__dirname, 'src');
  }

  async fix() {
    console.log('🔧 Fixing architecture violations...\n');

    // 1. Fix Provider layer violations
    await this.fixProviderLayerViolations();

    // 2. Remove hardcoded service names from transformers  
    await this.removeTransformerHardcoding();

    // 3. Remove service-specific logic from transformers
    await this.removeServiceSpecificLogic();

    // 4. Remove duplicate UNEXPECTED_TOOL_CALL logic
    await this.removeDuplicateLogic();

    // 5. Report results
    this.reportResults();
  }

  /**
   * 修复Provider层违反：移除transformer和preprocessing导入
   */
  async fixProviderLayerViolations() {
    console.log('🏗️ Fixing Provider layer violations...');

    const providerFiles = this.getAllTSFiles(path.join(this.srcPath, 'providers'));
    
    for (const file of providerFiles) {
      let content = fs.readFileSync(file, 'utf8');
      let modified = false;
      const originalContent = content;

      // 移除transformer相关导入
      const transformerImports = [
        /import.*from\s+['"`][^'"`]*transformers[^'"`]*['"`];?\s*\n/g,
        /import.*transformationManager.*from.*;\s*\n/g,
        /import.*transformer.*from.*;\s*\n/g
      ];

      for (const pattern of transformerImports) {
        if (pattern.test(content)) {
          content = content.replace(pattern, '');
          modified = true;
        }
      }

      // 移除preprocessing相关导入
      const preprocessingImports = [
        /import.*from\s+['"`][^'"`]*preprocessing[^'"`]*['"`];?\s*\n/g,
        /import.*preprocessor.*from.*;\s*\n/g,
        /import.*Preprocessor.*from.*;\s*\n/g
      ];

      for (const pattern of preprocessingImports) {
        if (pattern.test(content)) {
          content = content.replace(pattern, '');
          modified = true;
        }
      }

      // 移除output layer导入
      const outputImports = [
        /import.*from\s+['"`][^'"`]*output[^'"`]*['"`];?\s*\n/g
      ];

      for (const pattern of outputImports) {
        if (pattern.test(content)) {
          content = content.replace(pattern, '');
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(file, content);
        this.fixes.push({
          file: file.replace(__dirname + '/', ''),
          type: 'provider_layer_violation',
          description: 'Removed transformer/preprocessing/output imports from provider'
        });
      }
    }
  }

  /**
   * 移除transformer中的硬编码服务名
   */
  async removeTransformerHardcoding() {
    console.log('🧹 Removing hardcoded service names from transformers...');

    const transformerFiles = this.getAllTSFiles(path.join(this.srcPath, 'transformers'));
    
    for (const file of transformerFiles) {
      let content = fs.readFileSync(file, 'utf8');
      let modified = false;

      // 替换硬编码的服务名为配置驱动
      const hardcodingPatterns = [
        {
          pattern: /['"`]shuaihong['"`]/g,
          replacement: 'config.serviceName || \'openai-compatible\''
        },
        {
          pattern: /['"`]modelscope['"`]/g,
          replacement: 'config.serviceName || \'openai-compatible\''
        },
        {
          pattern: /['"`]lmstudio['"`]/g,
          replacement: 'config.serviceName || \'openai-compatible\''
        },
        {
          pattern: /['"`]openai-key\\d+['"`]/g,
          replacement: 'config.serviceName || \'openai-compatible\''
        }
      ];

      for (const { pattern, replacement } of hardcodingPatterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, replacement);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(file, content);
        this.fixes.push({
          file: file.replace(__dirname + '/', ''),
          type: 'hardcoding_removal',
          description: 'Replaced hardcoded service names with config-driven approach'
        });
      }
    }
  }

  /**
   * 移除transformer中的服务特定逻辑
   */
  async removeServiceSpecificLogic() {
    console.log('⚡ Removing service-specific logic from transformers...');

    const geminiTransformerPath = path.join(this.srcPath, 'transformers/gemini.ts');
    
    if (fs.existsSync(geminiTransformerPath)) {
      let content = fs.readFileSync(geminiTransformerPath, 'utf8');
      
      // 检查是否还有服务特定逻辑
      const serviceSpecificPatterns = [
        'createUnexpectedToolCallResponse',
        'ShuaiHong.*patch',
        'ModelScope.*fix',
        'LMStudio.*handling'
      ];

      let hasServiceLogic = false;
      for (const pattern of serviceSpecificPatterns) {
        if (new RegExp(pattern, 'i').test(content)) {
          hasServiceLogic = true;
          break;
        }
      }

      if (hasServiceLogic) {
        // 添加注释说明这些逻辑已经移到patches系统
        const comment = `\n/**\n * NOTE: Service-specific logic has been moved to the patches system.\n * Transformer layer now only handles pure format conversion.\n * Special cases like UNEXPECTED_TOOL_CALL are handled by:\n * - src/patches/ (for provider-specific fixes)\n * - src/preprocessing/ (for unified preprocessing)\n */\n`;
        
        content = comment + content;
        
        fs.writeFileSync(geminiTransformerPath, content);
        
        this.fixes.push({
          file: 'src/transformers/gemini.ts',
          type: 'service_logic_removal',
          description: 'Added note about service-specific logic migration to patches system'
        });
      }
    }
  }

  /**
   * 移除重复的修复逻辑
   */
  async removeDuplicateLogic() {
    console.log('🔄 Identifying duplicate fix logic...');

    const duplicatePatterns = [
      'UNEXPECTED_TOOL_CALL',
      'tool.*call.*detection'
    ];

    const allFiles = [
      ...this.getAllTSFiles(path.join(this.srcPath, 'transformers')),
      ...this.getAllTSFiles(path.join(this.srcPath, 'providers')),
      ...this.getAllTSFiles(path.join(this.srcPath, 'preprocessing'))
    ];

    const duplicateLocations = new Map();

    for (const pattern of duplicatePatterns) {
      const regex = new RegExp(pattern, 'gi');
      const locations = [];
      
      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const matches = content.match(regex);
        
        if (matches && matches.length > 0) {
          locations.push({
            file: file.replace(__dirname + '/', ''),
            count: matches.length
          });
        }
      }

      if (locations.length > 1) {
        duplicateLocations.set(pattern, locations);
      }
    }

    // 报告重复逻辑位置
    for (const [pattern, locations] of duplicateLocations) {
      this.fixes.push({
        type: 'duplicate_logic_identified',
        pattern,
        description: `Pattern '${pattern}' found in multiple files: ${locations.map(l => l.file).join(', ')}`,
        locations
      });
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
    console.log('\n📊 Architecture Fix Results');
    console.log('============================\n');

    if (this.fixes.length === 0) {
      console.log('✅ No fixes needed - architecture is already compliant.\n');
      return;
    }

    // 按类型分组
    const fixesByType = new Map();
    
    for (const fix of this.fixes) {
      if (!fixesByType.has(fix.type)) {
        fixesByType.set(fix.type, []);
      }
      fixesByType.get(fix.type).push(fix);
    }

    // 输出修复详情
    for (const [type, fixes] of fixesByType) {
      console.log(`🔧 ${this.getTypeDisplayName(type)} (${fixes.length} fixes):`);
      
      for (const fix of fixes) {
        if (fix.file) {
          console.log(`  ✅ ${fix.file}`);
          console.log(`     ${fix.description}`);
        } else {
          console.log(`  📍 ${fix.description}`);
          if (fix.locations) {
            console.log(`     Files: ${fix.locations.map(l => l.file).join(', ')}`);
          }
        }
        console.log();
      }
    }

    console.log(`\nSummary: ${this.fixes.length} architecture fixes applied`);
    
    // 建议下一步
    console.log('\n🎯 Next Steps:');
    console.log('1. Run the validation script: node validate-clean-architecture.js');
    console.log('2. Test the refactored components');
    console.log('3. Update any remaining manual references');
    console.log('4. Consider updating documentation');
  }

  /**
   * 获取修复类型的显示名称
   */
  getTypeDisplayName(type) {
    const displayNames = {
      'provider_layer_violation': 'Provider Layer Import Fixes',
      'hardcoding_removal': 'Hardcoded Service Name Removal',
      'service_logic_removal': 'Service-Specific Logic Migration',
      'duplicate_logic_identified': 'Duplicate Logic Detection'
    };
    
    return displayNames[type] || type;
  }
}

// 运行修复
const fixer = new ArchitectureFixer();
fixer.fix().catch(console.error);