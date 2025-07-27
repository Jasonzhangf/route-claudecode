#!/usr/bin/env node

/**
 * 使用demo2的Go解析器测试原始响应
 */

const fs = require('fs');
const { execSync } = require('child_process');

// 使用之前保存的原始响应数据
const rawResponseFile = 'debug-codewhisperer-raw-2025-07-26T14-38-26-427Z.bin';

if (!fs.existsSync(rawResponseFile)) {
  console.error('❌ 原始响应文件不存在:', rawResponseFile);
  console.log('请先运行: node debug-codewhisperer-raw-response.js');
  process.exit(1);
}

console.log('🔍 使用demo2解析器测试原始响应...\n');

try {
  // 复制原始响应文件到demo2目录
  const demo2ResponseFile = 'examples/demo2/test-response.bin';
  execSync(`cp ${rawResponseFile} ${demo2ResponseFile}`);
  
  // 创建简化的Go测试程序
  const goTestCode = `package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	
	"github.com/bestk/kiro2cc/parser"
)

func main() {
	data, err := ioutil.ReadFile("test-response.bin")
	if err != nil {
		log.Fatal("Failed to read response file:", err)
	}
	
	fmt.Printf("Raw response length: %d bytes\\n", len(data))
	
	events := parser.ParseEvents(data)
	fmt.Printf("Parsed %d events:\\n", len(events))
	
	for i, event := range events {
		eventJSON, _ := json.MarshalIndent(event, "", "  ")
		fmt.Printf("[%d] %s\\n", i, string(eventJSON))
	}
}`;

  // 写入Go测试文件
  fs.writeFileSync('examples/demo2/test-parser.go', goTestCode);
  
  // 运行Go测试
  console.log('🚀 运行demo2解析器测试...\n');
  const result = execSync('cd examples/demo2 && go run test-parser.go', { encoding: 'utf8' });
  console.log(result);
  
  // 清理临时文件
  execSync('rm examples/demo2/test-response.bin examples/demo2/test-parser.go');
  
  console.log('\n✨ Demo2解析器测试完成!');
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  console.error('错误详情:', error.stdout || error.stderr);
  
  // 清理临时文件
  try {
    execSync('rm -f examples/demo2/test-response.bin examples/demo2/test-parser.go');
  } catch {}
}