/**
 * Six-Layer Architecture Test Script
 * 测试最终的六层架构实现
 */

import { SixLayerServer } from './dist/v3/server/six-layer-server.js';

console.log('🚀 Testing Six-Layer Architecture...');

// 测试配置
const testConfig = {
  server: {
    port: 5600,
    host: '0.0.0.0',
    name: 'six-layer-test-server'
  },
  providers: {
    'google-gemini': {
      type: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com',
      authentication: {
        type: 'bearer',
        credentials: {
          apiKeys: [
            'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
            'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA',
            'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
          ]
        }
      },
      models: [
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b'
      ],
      defaultModel: 'gemini-2.0-flash-exp',
      timeout: 60000,
      maxRetries: 3,
      retryDelay: 2000
    }
  },
  routing: {
    categories: {
      default: {
        providers: [
          {
            provider: 'google-gemini',
            model: 'gemini-2.0-flash-exp',
            weight: 1.0
          }
        ]
      }
    }
  },
  debug: {
    enabled: true,
    logLevel: 'debug',
    traceRequests: true,
    saveRequests: false,
    enableRecording: false,
    enableAuditTrail: false,
    enableReplay: false,
    enablePerformanceMetrics: true,
    logDir: '/tmp'
  }
};

async function testSixLayerArchitecture() {
  try {
    console.log('📐 Initializing Six-Layer Server...');
    const server = new SixLayerServer(testConfig);
    
    console.log('🎯 Starting server...');
    await server.start();
    
    console.log('✅ Six-Layer Architecture test server started successfully!');
    console.log('📊 Architecture layers:');
    console.log('   1. Client Layer - HTTP to BaseRequest conversion');
    console.log('   2. Router Layer - Authentication, routing, load balancing');
    console.log('   3. Client-Layer-Processor - Client response formatting');
    console.log('   4. Transformer Layer - Protocol transformations');
    console.log('   5. Provider-Protocol Layer - API communication');
    console.log('   6. Server-Layer-Processor - Server request preprocessing');
    
    console.log('🌐 Test endpoints:');
    console.log(`   GET  http://localhost:5600/health`);
    console.log(`   GET  http://localhost:5600/status`);
    console.log(`   GET  http://localhost:5600/routing`);
    console.log(`   POST http://localhost:5600/v1/messages`);
    
    // 等待用户测试
    console.log('🔍 Server is running. Press Ctrl+C to stop.');
    
    // 设置优雅关闭
    process.on('SIGINT', async () => {
      console.log('\\n🛑 Stopping Six-Layer Server...');
      try {
        await server.stop();
        console.log('✅ Server stopped successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error stopping server:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ Six-Layer Architecture test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testSixLayerArchitecture();