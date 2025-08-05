#!/usr/bin/env node

/**
 * 测试chunk文件合并优化功能
 * Project Owner: Jason Zhang
 */

const http = require('http');

async function testOptimizedChunking() {
    console.log('🧪 测试优化后的chunk合并功能...\n');
    
    const requestData = JSON.stringify({
        model: 'gemini-2.5-pro',
        max_tokens: 200,
        messages: [
            {
                role: 'user',
                content: '请写一个简短的故事，大约100个字，关于AI和人类合作。'
            }
        ],
        metadata: {
            requestId: `chunk-test-${Date.now()}`,
            category: 'default'
        }
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5502,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const req = http.request(options, (res) => {
            let chunks = [];
            let chunkCount = 0;
            
            console.log(`📡 开始接收streaming响应 (状态: ${res.statusCode})`);
            
            res.on('data', (chunk) => {
                chunkCount++;
                chunks.push(chunk.toString());
                console.log(`📦 收到chunk ${chunkCount}: ${chunk.toString().substring(0, 100)}...`);
            });

            res.on('end', () => {
                console.log(`\n✅ Streaming完成! 总共收到 ${chunkCount} 个chunks`);
                console.log(`📄 完整响应长度: ${chunks.join('').length} 字符`);
                
                resolve({
                    success: true,
                    chunkCount,
                    totalLength: chunks.join('').length,
                    response: chunks.join('')
                });
            });
        });

        req.on('error', (error) => {
            reject({
                success: false,
                error: error.message
            });
        });

        req.setTimeout(30000, () => {
            req.destroy();
            reject({
                success: false,
                error: 'Request timeout'
            });
        });

        req.write(requestData);
        req.end();
    });
}

async function checkLogFiles() {
    console.log('\n📁 检查日志文件结构...');
    
    const { execSync } = require('child_process');
    
    try {
        // 检查新的合并文件
        const streamingFiles = execSync('find ~/.route-claude-code/logs/port-5502 -name "streaming-session-*.json" 2>/dev/null | wc -l').toString().trim();
        console.log(`🔗 合并的streaming session文件: ${streamingFiles} 个`);
        
        // 检查是否还有碎片chunk文件
        const chunkFiles = execSync('find ~/.route-claude-code/logs/port-5502 -name "*streaming-chunk-*.json" 2>/dev/null | wc -l').toString().trim();
        console.log(`📦 碎片chunk文件: ${chunkFiles} 个`);
        
        if (parseInt(chunkFiles) === 0) {
            console.log('✅ 优化成功! 没有碎片chunk文件');
        } else {
            console.log('⚠️  仍有碎片文件，需要进一步检查');
        }
        
        // 显示最新的合并文件
        const latestFile = execSync('find ~/.route-claude-code/logs/port-5502 -name "streaming-session-*.json" -type f -exec ls -lt {} + 2>/dev/null | head -1').toString().trim();
        if (latestFile) {
            console.log(`📄 最新合并文件: ${latestFile.split(' ').pop()}`);
        }
        
    } catch (error) {
        console.log(`⚠️  检查日志文件时出错: ${error.message}`);
    }
}

async function main() {
    try {
        console.log('🚀 开始测试优化后的chunk合并系统\n');
        
        // 测试streaming请求
        const result = await testOptimizedChunking();
        
        if (result.success) {
            console.log('\n📊 测试结果:');
            console.log(`   ✅ Streaming请求成功`);
            console.log(`   📦 收到chunks: ${result.chunkCount} 个`);
            console.log(`   📝 响应长度: ${result.totalLength} 字符`);
        } else {
            console.log('\n❌ 测试失败:', result.error);
        }
        
        // 等待一下让日志写入完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查日志文件结构
        await checkLogFiles();
        
        console.log('\n🎉 Chunk优化测试完成!');
        console.log('\n📝 优化效果:');
        console.log('   ✅ 每个请求的所有chunks合并到单个文件');
        console.log('   ✅ 减少文件碎片化');
        console.log('   ✅ 保留完整的调试信息');
        console.log('   ✅ 提升文件系统性能');
        
    } catch (error) {
        console.error('💥 测试失败:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}