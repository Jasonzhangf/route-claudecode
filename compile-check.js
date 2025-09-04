const { exec } = require('child_process');

console.log('🔍 运行TypeScript编译检查...');

exec('npx tsc --noEmit --project tsconfig.json', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ TypeScript编译错误:');
    console.log(stderr || stdout);
    process.exit(1);
  } else {
    console.log('✅ TypeScript编译检查通过!');
    console.log(stdout || '无输出');
    process.exit(0);
  }
});