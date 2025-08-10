#!/usr/bin/env node

const fs = require('fs');

// 文件路径
const filePath = '/Users/fanzhang/Documents/github/claude-code-router/src/providers/openai/unified-conversion-client.ts';

// 读取文件内容
let content = fs.readFileSync(filePath, 'utf8');

// 替换中文注释
content = content.replace('后处理和一致性验证', 'Post-processing and consistency validation');

// 写回文件
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ 统一转换客户端中的中文注释已替换为英文');