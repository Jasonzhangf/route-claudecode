const fs = require('fs');
const path = require('path');

const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
const debugBasePath = path.join(homeDir, '.route-claudecode', 'debug-logs');

console.log('🔍 验证日志目录结构...');
console.log('基础路径:', debugBasePath);

if (!fs.existsSync(debugBasePath)) {
  console.log('❌ 基础日志目录不存在');
  process.exit(1);
}

console.log('✅ 基础日志目录存在');

const portDir = path.join(debugBasePath, 'port-5506');
if (fs.existsSync(portDir)) {
  console.log('✅ 端口目录存在:', portDir);
  
  const sessionDirs = fs.readdirSync(portDir).filter(dir => dir.startsWith('session-'));
  if (sessionDirs.length > 0) {
    console.log('✅ 会话目录存在:', sessionDirs.length, '个会话');
    
    const sessionDir = path.join(portDir, sessionDirs[0]);
    const subDirs = ['requests', 'pipelines', 'startup'];
    
    let allExist = true;
    subDirs.forEach(subDir => {
      const subDirPath = path.join(sessionDir, subDir);
      if (fs.existsSync(subDirPath)) {
        console.log('✅ 子目录存在:', subDir);
      } else {
        console.log('❌ 子目录不存在:', subDir);
        allExist = false;
      }
    });
    
    if (allExist) {
      console.log('\n🎉 端口日志目录结构验证通过!');
      console.log('📋 目录结构:');
      console.log(debugBasePath);
      console.log('└── port-5506');
      console.log('    └──', sessionDirs[0]);
      console.log('        ├── requests');
      console.log('        ├── pipelines');
      console.log('        └── startup');
    } else {
      console.log('\n⚠️ 部分目录结构缺失');
    }
  } else {
    console.log('⚠️ 暂无会话目录');
  }
} else {
  console.log('⚠️ 端口目录不存在');
  
  const defaultDir = path.join(debugBasePath, 'default');
  if (fs.existsSync(defaultDir)) {
    console.log('❌ 发现default目录，说明端口信息未正确传递');
  } else {
    console.log('❓ 既无端口目录也无default目录');
  }
}