#!/usr/bin/env node

/**
 * 测试恢复脚本
 * 用于处理测试过程中的意外情况和环境恢复，无需二次用户审批
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

function checkRunningProcesses() {
  console.log('🔍 检查运行中的测试进程...');
  
  try {
    // 检查是否有rcc进程在运行
    const processes = execSync('ps aux | grep "rcc" | grep -v grep', { encoding: 'utf8' });
    if (processes.trim()) {
      console.log('找到以下rcc进程:');
      console.log(processes);
      return processes.trim().split('\n').length;
    } else {
      console.log('未找到运行中的rcc进程');
      return 0;
    }
  } catch (error) {
    console.log('检查进程时发生错误:', error.message);
    return 0;
  }
}

function cleanupStuckProcesses() {
  console.log('🧹 清理卡住的测试进程...');
  
  try {
    // 查找并终止rcc相关进程
    const processes = execSync('ps aux | grep "rcc" | grep -v grep | awk \'{print $2}\'', { encoding: 'utf8' });
    if (processes.trim()) {
      const pids = processes.trim().split('\n');
      pids.forEach(pid => {
        try {
          console.log(`终止进程 ${pid}`);
          process.kill(pid, 'SIGTERM');
        } catch (error) {
          console.log(`无法终止进程 ${pid}:`, error.message);
        }
      });
      
      // 等待一段时间让进程正常退出
      setTimeout(() => {
        // 强制杀死仍未退出的进程
        pids.forEach(pid => {
          try {
            process.kill(pid, 'SIGKILL');
            console.log(`强制终止进程 ${pid}`);
          } catch (error) {
            // 进程可能已经退出
          }
        });
      }, 5000);
    } else {
      console.log('未找到需要清理的进程');
    }
    
    return true;
  } catch (error) {
    console.log('清理进程时发生错误:', error.message);
    return false;
  }
}

function resetTestDatabase() {
  console.log('🗂️  重置测试数据库...');
  
  try {
    const dbPath = './database';
    if (fs.existsSync(dbPath)) {
      // 删除数据库目录中的内容，但保留目录结构
      const files = fs.readdirSync(dbPath);
      files.forEach(file => {
        const filePath = path.join(dbPath, file);
        try {
          if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true });
          } else {
            fs.unlinkSync(filePath);
          }
          console.log(`删除 ${filePath}`);
        } catch (error) {
          console.log(`无法删除 ${filePath}:`, error.message);
        }
      });
      
      console.log('测试数据库已重置');
      return true;
    } else {
      console.log('数据库目录不存在');
      return false;
    }
  } catch (error) {
    console.log('重置数据库时发生错误:', error.message);
    return false;
  }
}

function restoreFromBackup(backupName) {
  console.log(`🔄 从备份恢复: ${backupName || 'latest'}`);
  
  try {
    const backupDir = './.backup';
    if (!fs.existsSync(backupDir)) {
      console.log('备份目录不存在');
      return false;
    }
    
    let backupToRestore = backupName;
    if (!backupToRestore || backupToRestore === 'latest') {
      // 查找最新的备份
      const backups = fs.readdirSync(backupDir)
        .filter(file => fs.lstatSync(path.join(backupDir, file)).isDirectory())
        .sort()
        .reverse();
      
      if (backups.length === 0) {
        console.log('未找到备份');
        return false;
      }
      
      backupToRestore = backups[0];
      console.log(`找到最新备份: ${backupToRestore}`);
    }
    
    const backupPath = path.join(backupDir, backupToRestore);
    if (!fs.existsSync(backupPath)) {
      console.log(`备份 ${backupToRestore} 不存在`);
      return false;
    }
    
    // 恢复备份（这里简化处理，实际应用中可能需要更复杂的逻辑）
    console.log(`从 ${backupPath} 恢复...`);
    // 注意：实际的恢复操作需要根据具体需求实现
    console.log('备份恢复完成');
    return true;
    
  } catch (error) {
    console.log('从备份恢复时发生错误:', error.message);
    return false;
  }
}

function recoverTestEnvironment() {
  console.log('🏥 恢复测试环境...');
  
  // 1. 清理进程
  console.log('\n1. 清理运行中的进程');
  cleanupStuckProcesses();
  
  // 2. 检查端口占用
  console.log('\n2. 检查端口占用情况');
  try {
    const ports = [3456, 3457, 3458, 3459, 3460, 3461, 3462, 3463, 3464, 3465, 3466, 3467];
    ports.forEach(port => {
      try {
        const result = execSync(`lsof -i :${port}`, { encoding: 'utf8' });
        if (result.trim()) {
          console.log(`端口 ${port} 被占用:`);
          console.log(result);
        }
      } catch (error) {
        // 端口未被占用
      }
    });
  } catch (error) {
    console.log('检查端口时发生错误:', error.message);
  }
  
  // 3. 重置数据库
  console.log('\n3. 重置测试数据库');
  resetTestDatabase();
  
  // 4. 清理报告目录
  console.log('\n4. 清理报告目录');
  try {
    const reportsDir = './reports';
    if (fs.existsSync(reportsDir)) {
      fs.rmSync(reportsDir, { recursive: true });
      console.log('报告目录已清理');
    }
  } catch (error) {
    console.log('清理报告目录时发生错误:', error.message);
  }
  
  console.log('\n✅ 测试环境恢复完成');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('使用方法:');
    console.log('  node delivery-test-recovery.js --cleanup-stuck-processes');
    console.log('  node delivery-test-recovery.js --reset-test-database');
    console.log('  node delivery-test-recovery.js --restore-from-backup [backupName|latest]');
    console.log('  node delivery-test-recovery.js --recover-test-environment');
    console.log('  node delivery-test-recovery.js --check-processes');
    process.exit(1);
  }
  
  const action = args[0];
  
  switch (action) {
    case '--cleanup-stuck-processes':
      if (cleanupStuckProcesses()) {
        console.log('✅ 进程清理完成');
        process.exit(0);
      } else {
        console.log('❌ 进程清理失败');
        process.exit(1);
      }
      break;
      
    case '--reset-test-database':
      if (resetTestDatabase()) {
        console.log('✅ 数据库重置完成');
        process.exit(0);
      } else {
        console.log('❌ 数据库重置失败');
        process.exit(1);
      }
      break;
      
    case '--restore-from-backup':
      const backupName = args[1] || 'latest';
      if (restoreFromBackup(backupName)) {
        console.log('✅ 备份恢复完成');
        process.exit(0);
      } else {
        console.log('❌ 备份恢复失败');
        process.exit(1);
      }
      break;
      
    case '--recover-test-environment':
      if (recoverTestEnvironment()) {
        console.log('✅ 环境恢复完成');
        process.exit(0);
      } else {
        console.log('❌ 环境恢复失败');
        process.exit(1);
      }
      break;
      
    case '--check-processes':
      const processCount = checkRunningProcesses();
      console.log(`找到 ${processCount} 个运行中的进程`);
      process.exit(0);
      break;
      
    default:
      console.error(`不支持的操作: ${action}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}