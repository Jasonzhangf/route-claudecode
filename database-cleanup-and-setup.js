#!/usr/bin/env node

/**
 * 数据库清理和设置脚本
 * 根据新数据库设计清理现有数据，建立标准结构
 * Project owner: Jason Zhang
 */

const fs = require('fs').promises;
const path = require('path');

// 配置
const CONFIG = {
  oldDatabasePath: './database',
  newDatabasePath: './database/pipeline-data-unified',
  backupPath: `./database/backup-${Date.now()}`,
  logFile: `/tmp/database-cleanup-${Date.now()}.log`
};

// 日志函数
function log(message, data = '') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}`;
  console.log(logLine);
  require('fs').appendFileSync(CONFIG.logFile, logLine + '\n');
}

// 新数据库结构定义
const NEW_DATABASE_STRUCTURE = {
  'data-points': {
    'codewhisperer': {},
    'openai': {},
    'gemini': {},
    'anthropic': {}
  },
  'flows': {
    'codewhisperer': {},
    'openai': {},
    'gemini': {},
    'anthropic': {}
  },
  'analytics': {
    'individual-module-logic': {},
    'pipeline-simulation': {},
    'real-pipeline-tests': {},
    'performance-metrics': {}
  },
  'exports': {
    'json': {},
    'csv': {},
    'reports': {}
  },
  'indexes': {
    'by-provider': {},
    'by-date': {},
    'by-request-id': {},
    'by-step': {}
  },
  'simulation-data': {
    'module-tests': {},
    'pipeline-mock-data': {},
    'test-scenarios': {}
  }
};

/**
 * 创建目录结构
 */
async function createDirectoryStructure(basePath, structure, currentPath = '') {
  for (const [key, value] of Object.entries(structure)) {
    const fullPath = path.join(basePath, currentPath, key);
    
    try {
      await fs.mkdir(fullPath, { recursive: true });
      log(`✅ 创建目录: ${fullPath}`);
      
      if (typeof value === 'object' && Object.keys(value).length > 0) {
        await createDirectoryStructure(basePath, value, path.join(currentPath, key));
      }
    } catch (error) {
      log(`❌ 创建目录失败: ${fullPath}`, error.message);
      throw error;
    }
  }
}

/**
 * 备份现有数据
 */
async function backupExistingData() {
  log('开始备份现有数据');
  
  try {
    // 创建备份目录
    await fs.mkdir(CONFIG.backupPath, { recursive: true });
    
    // 需要备份的重要文件
    const filesToBackup = [
      'openai-test-data.json',
      'openai-test-metrics.json',
      'pipeline-data-new/migration-metadata.json',
      'pipeline-data-new/analytics/individual-module-logic-report.json',
      'pipeline-data-new/analytics/load-balance-openai-test-report.json',
      'pipeline-data-new/analytics/pipeline-simulation-report.json',
      'pipeline-data-new/analytics/real-pipeline-test-report.json'
    ];
    
    let backedUpCount = 0;
    
    for (const file of filesToBackup) {
      const sourcePath = path.join(CONFIG.oldDatabasePath, file);
      const backupFilePath = path.join(CONFIG.backupPath, file);
      
      try {
        const stat = await fs.stat(sourcePath);
        if (stat.isFile()) {
          // 确保备份目录存在
          await fs.mkdir(path.dirname(backupFilePath), { recursive: true });
          
          // 复制文件
          const data = await fs.readFile(sourcePath);
          await fs.writeFile(backupFilePath, data);
          
          log(`✅ 备份文件: ${file}`);
          backedUpCount++;
        }
      } catch (error) {
        log(`⚠️ 备份文件失败 (文件可能不存在): ${file}`);
      }
    }
    
    log(`备份完成，共备份 ${backedUpCount} 个文件到: ${CONFIG.backupPath}`);
    
  } catch (error) {
    log(`❌ 备份过程失败`, error.message);
    throw error;
  }
}

/**
 * 迁移有效数据到新结构
 */
async function migrateData() {
  log('开始迁移有效数据到新结构');
  
  try {
    // 迁移现有的分析报告
    const analyticsFiles = [
      'individual-module-logic-report.json',
      'load-balance-openai-test-report.json', 
      'pipeline-simulation-report.json',
      'real-pipeline-test-report.json'
    ];
    
    let migratedCount = 0;
    
    for (const file of analyticsFiles) {
      const sourcePath = path.join(CONFIG.oldDatabasePath, 'pipeline-data-new/analytics', file);
      const targetPath = path.join(CONFIG.newDatabasePath, 'analytics', file);
      
      try {
        const data = await fs.readFile(sourcePath);
        await fs.writeFile(targetPath, data);
        log(`✅ 迁移分析文件: ${file}`);
        migratedCount++;
      } catch (error) {
        log(`⚠️ 迁移分析文件失败: ${file}`);
      }
    }
    
    // 迁移测试数据
    const testDataFiles = [
      'openai-test-data.json',
      'openai-test-metrics.json'
    ];
    
    for (const file of testDataFiles) {
      const sourcePath = path.join(CONFIG.oldDatabasePath, file);
      const targetPath = path.join(CONFIG.newDatabasePath, 'exports/json', file);
      
      try {
        const data = await fs.readFile(sourcePath);
        await fs.writeFile(targetPath, data);
        log(`✅ 迁移测试数据: ${file}`);
        migratedCount++;
      } catch (error) {
        log(`⚠️ 迁移测试数据失败: ${file}`);
      }
    }
    
    log(`数据迁移完成，共迁移 ${migratedCount} 个文件`);
    
  } catch (error) {
    log(`❌ 数据迁移失败`, error.message);
    throw error;
  }
}

/**
 * 创建初始化配置文件
 */
async function createInitialConfig() {
  log('创建初始化配置文件');
  
  try {
    // 数据库配置文件
    const dbConfig = {
      version: '2.0.0',
      created: new Date().toISOString(),
      structure: NEW_DATABASE_STRUCTURE,
      retention: {
        days: 30,
        maxSizeMB: 500
      },
      compression: true,
      validation: {
        strictMode: true,
        requiredFields: ['requestId', 'sessionId', 'model', 'category', 'configPath']
      },
      paths: {
        dataPoints: 'data-points',
        flows: 'flows',  
        analytics: 'analytics',
        exports: 'exports',
        indexes: 'indexes',
        simulationData: 'simulation-data'
      }
    };
    
    await fs.writeFile(
      path.join(CONFIG.newDatabasePath, 'database-config.json'),
      JSON.stringify(dbConfig, null, 2),
      'utf8'
    );
    
    // 标准流水线测试配置
    const pipelineTestConfig = {
      version: '2.0.0',
      created: new Date().toISOString(),
      testFlow: {
        phases: [
          '1-database-cleanup',
          '2-data-capture-system',
          '3-module-data-simulation',
          '4-individual-module-logic-tests',
          '5-pipeline-simulation-tests', 
          '6-real-pipeline-tests'
        ],
        dataCapture: {
          enabled: true,
          basePath: './database/pipeline-data-unified',
          captureAllSteps: true,
          detailedMetrics: true
        },
        simulation: {
          useRealData: true,
          mockExternalCalls: false,
          validateAllSteps: true
        }
      },
      providers: {
        codewhisperer: {
          testModels: ['CLAUDE_SONNET_4_20250514_V1_0', 'CLAUDE_3_7_SONNET'],
          testEndpoints: [5501, 5503, 5504, 5505]
        },
        openai: {
          testModels: ['qwen3-30b', 'glm-4.5-air'],
          testEndpoints: [5506, 5507, 5508, 5509]
        },
        gemini: {
          testModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
          testEndpoints: [5502]
        },
        anthropic: {
          testModels: ['claude-3-5-sonnet-20241022'],
          testEndpoints: [3456]
        }
      }
    };
    
    await fs.writeFile(
      path.join(CONFIG.newDatabasePath, 'pipeline-test-config.json'),
      JSON.stringify(pipelineTestConfig, null, 2),
      'utf8'
    );
    
    log('✅ 初始化配置文件创建完成');
    
  } catch (error) {
    log(`❌ 配置文件创建失败`, error.message);
    throw error;
  }
}

/**
 * 清理旧数据（可选）
 */
async function cleanupOldData() {
  log('清理旧数据结构');
  
  try {
    // 标记为清理的目录
    const directoriesToCleanup = [
      path.join(CONFIG.oldDatabasePath, 'pipeline-data-new'),
      path.join(CONFIG.oldDatabasePath, 'pipeline-data-capture')
    ];
    
    let cleanedCount = 0;
    
    for (const dir of directoriesToCleanup) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        log(`✅ 清理目录: ${dir}`);
        cleanedCount++;
      } catch (error) {
        log(`⚠️ 清理目录失败: ${dir}`);
      }
    }
    
    // 清理旧文件
    const filesToCleanup = [
      'openai-test-data-capture.js',
      'openai-test-data.json',
      'openai-test-metrics.json'
    ];
    
    for (const file of filesToCleanup) {
      const filePath = path.join(CONFIG.oldDatabasePath, file);
      try {
        await fs.unlink(filePath);
        log(`✅ 清理文件: ${file}`);
        cleanedCount++;
      } catch (error) {
        log(`⚠️ 清理文件失败: ${file}`);
      }
    }
    
    log(`清理完成，共清理 ${cleanedCount} 个项目`);
    
  } catch (error) {
    log(`❌ 清理过程失败`, error.message);
    throw error;
  }
}

/**
 * 验证新数据库结构
 */
async function validateNewStructure() {
  log('验证新数据库结构');
  
  try {
    const requiredPaths = [
      'data-points/codewhisperer',
      'data-points/openai',
      'data-points/gemini',
      'data-points/anthropic',
      'flows/codewhisperer',
      'flows/openai', 
      'flows/gemini',
      'flows/anthropic',
      'analytics/individual-module-logic',
      'analytics/pipeline-simulation',
      'analytics/real-pipeline-tests',
      'analytics/performance-metrics',
      'exports/json',
      'exports/csv',
      'exports/reports',
      'indexes/by-provider',
      'indexes/by-date',
      'indexes/by-request-id',
      'indexes/by-step',
      'simulation-data/module-tests',
      'simulation-data/pipeline-mock-data',
      'simulation-data/test-scenarios'
    ];
    
    let validatedCount = 0;
    
    for (const requiredPath of requiredPaths) {
      const fullPath = path.join(CONFIG.newDatabasePath, requiredPath);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          validatedCount++;
        }
      } catch (error) {
        log(`❌ 缺少必需目录: ${requiredPath}`);
        throw new Error(`Missing required directory: ${requiredPath}`);
      }
    }
    
    // 检查配置文件
    const configFiles = ['database-config.json', 'pipeline-test-config.json'];
    for (const configFile of configFiles) {
      const filePath = path.join(CONFIG.newDatabasePath, configFile);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          validatedCount++;
        }
      } catch (error) {
        log(`❌ 缺少配置文件: ${configFile}`);
        throw new Error(`Missing config file: ${configFile}`);
      }
    }
    
    log(`✅ 数据库结构验证通过，共验证 ${validatedCount} 个项目`);
    
  } catch (error) {
    log(`❌ 数据库结构验证失败`, error.message);
    throw error;
  }
}

/**
 * 主执行函数
 */
async function main() {
  log('🚀 开始数据库清理和设置流程');
  log('配置', CONFIG);
  
  try {
    // 步骤 1: 备份现有数据
    await backupExistingData();
    
    // 步骤 2: 创建新数据库结构
    log('\n📁 创建新数据库结构');
    await createDirectoryStructure(CONFIG.newDatabasePath, NEW_DATABASE_STRUCTURE);
    
    // 步骤 3: 迁移有效数据
    log('\n📦 迁移有效数据');
    await migrateData();
    
    // 步骤 4: 创建初始化配置
    log('\n⚙️ 创建初始化配置');
    await createInitialConfig();
    
    // 步骤 5: 验证新结构
    log('\n✅ 验证新数据库结构');
    await validateNewStructure();
    
    // 步骤 6: 清理旧数据（可选）
    log('\n🧹 清理旧数据结构');
    await cleanupOldData();
    
    // 完成报告
    log('\n🎉 数据库清理和设置完成');
    log('新数据库路径', CONFIG.newDatabasePath);
    log('备份路径', CONFIG.backupPath);
    log('日志文件', CONFIG.logFile);
    
    console.log('\n✅ 数据库清理和设置成功完成');
    console.log(`📁 新数据库: ${CONFIG.newDatabasePath}`);
    console.log(`💾 数据备份: ${CONFIG.backupPath}`);
    console.log(`📄 执行日志: ${CONFIG.logFile}`);
    
  } catch (error) {
    log(`❌ 数据库清理和设置失败`, error.message);
    console.log('\n❌ 执行失败:', error.message);
    console.log(`📄 详细日志: ${CONFIG.logFile}`);
    process.exit(1);
  }
}

// 执行脚本
if (require.main === module) {
  main();
}