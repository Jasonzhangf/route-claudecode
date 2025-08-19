/**
 * Demo1增强版路由器验证脚本
 * 验证多key轮询功能是否正常工作
 */

import { Demo1EnhancedRouter } from '../src/router/demo1-enhanced-router';
import { secureLogger } from '../src/utils/secure-logger';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

class Demo1EnhancedVerifier {
  private router: Demo1EnhancedRouter;
  private config: any;

  constructor(configPath: string) {
    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    this.config = JSON.parse(readFileSync(configPath, 'utf-8'));
    this.router = new Demo1EnhancedRouter(this.config);
    
    secureLogger.info('Demo1 Enhanced Router initialized', {
      configPath,
      providers: this.config.Providers?.length || 0
    });
  }

  /**
   * 验证基础路由功能
   */
  async verifyBasicRouting(): Promise<boolean> {
    try {
      secureLogger.info('Verifying basic routing functionality');

      const testRequest = {
        body: {
          model: 'claude-3-sonnet',
          messages: [
            { role: 'user', content: 'Basic routing test' }
          ]
        }
      };

      const result = await this.router.route(testRequest);
      
      if (!result) {
        secureLogger.error('Basic routing failed: No result returned');
        return false;
      }

      secureLogger.info('Basic routing verification successful', {
        provider: result.providerName,
        model: result.modelName,
        hasApiKey: !!result.apiKey,
        hasBaseUrl: !!result.apiBaseUrl
      });

      return true;
    } catch (error: any) {
      secureLogger.error('Basic routing verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * 验证多key轮询功能
   */
  async verifyMultiKeyRotation(): Promise<boolean> {
    try {
      secureLogger.info('Verifying multi-key rotation functionality');

      const usedKeys = new Set<string>();
      const results = [];

      // 发送多个请求验证key轮询
      for (let i = 0; i < 5; i++) {
        const request = {
          body: {
            model: 'claude-3-sonnet',
            messages: [
              { role: 'user', content: `Multi-key test request ${i + 1}` }
            ]
          }
        };

        const result = await this.router.route(request);
        if (result) {
          usedKeys.add(result.apiKey);
          results.push(result);
        }
      }

      const rotationWorking = usedKeys.size > 1;
      
      secureLogger.info('Multi-key rotation verification completed', {
        totalRequests: results.length,
        uniqueKeys: usedKeys.size,
        rotationWorking
      });

      return rotationWorking;
    } catch (error: any) {
      secureLogger.error('Multi-key rotation verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * 验证Demo1路由逻辑
   */
  async verifyDemo1Logic(): Promise<boolean> {
    try {
      secureLogger.info('Verifying Demo1 routing logic preservation');

      const testCases = [
        {
          name: 'Long Context Route',
          request: {
            body: {
              model: 'claude-3-sonnet',
              messages: [{ role: 'user', content: 'x'.repeat(250000) }]
            }
          },
          expectedCondition: (result: any) => result.providerName.includes('ModelScope') || result.modelName.includes('longContext')
        },
        {
          name: 'Thinking Route',
          request: {
            body: {
              model: 'claude-3-sonnet',
              thinking: true,
              messages: [{ role: 'user', content: 'Reasoning task' }]
            }
          },
          expectedCondition: (result: any) => this.config.Router.think.includes(result.providerName)
        },
        {
          name: 'Web Search Route',
          request: {
            body: {
              model: 'claude-3-sonnet',
              tools: [{ type: 'web_search', name: 'search' }],
              messages: [{ role: 'user', content: 'Search task' }]
            }
          },
          expectedCondition: (result: any) => this.config.Router.webSearch.includes(result.providerName)
        },
        {
          name: 'Background Route',
          request: {
            body: {
              model: 'claude-3-5-haiku',
              messages: [{ role: 'user', content: 'Background task' }]
            }
          },
          expectedCondition: (result: any) => this.config.Router.background.includes(result.providerName)
        }
      ];

      let passedTests = 0;

      for (const testCase of testCases) {
        try {
          const result = await this.router.route(testCase.request);
          
          if (result && testCase.expectedCondition(result)) {
            secureLogger.info(`${testCase.name} test passed`, {
              provider: result.providerName,
              model: result.modelName
            });
            passedTests++;
          } else {
            secureLogger.warn(`${testCase.name} test failed or unexpected result`, {
              result: result ? { provider: result.providerName, model: result.modelName } : null
            });
          }
        } catch (error: any) {
          secureLogger.error(`${testCase.name} test error`, { error: error.message });
        }
      }

      const allTestsPassed = passedTests === testCases.length;
      
      secureLogger.info('Demo1 logic verification completed', {
        passedTests,
        totalTests: testCases.length,
        allPassed: allTestsPassed
      });

      return allTestsPassed;
    } catch (error: any) {
      secureLogger.error('Demo1 logic verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * 验证Key失败处理
   */
  async verifyKeyFailureHandling(): Promise<boolean> {
    try {
      secureLogger.info('Verifying key failure handling');

      // 获取统计信息前的状态
      const statsBefore = this.router.getStats();
      
      // 模拟key失败
      const testProvider = this.config.Providers[0];
      if (testProvider && Array.isArray(testProvider.api_key) && testProvider.api_key.length > 1) {
        const failedKey = testProvider.api_key[0];
        this.router.markKeyFailed(testProvider.name, failedKey, new Error('Simulated failure'));
        
        secureLogger.info('Key failure simulation completed', {
          provider: testProvider.name,
          failedKey: failedKey.slice(-8)
        });

        // 验证后续请求使用备用key
        const request = {
          body: {
            model: 'claude-3-sonnet',
            messages: [{ role: 'user', content: 'Test after key failure' }]
          }
        };

        const result = await this.router.route(request);
        const keyFailureHandled = result && result.apiKey !== failedKey;

        secureLogger.info('Key failure handling verification', {
          handledCorrectly: keyFailureHandled,
          usedKey: result?.apiKey.slice(-8)
        });

        return keyFailureHandled;
      } else {
        secureLogger.warn('No multi-key provider found for failure testing');
        return true; // 如果没有多key provider，跳过此测试
      }
    } catch (error: any) {
      secureLogger.error('Key failure handling verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * 运行完整验证
   */
  async runCompleteVerification(): Promise<boolean> {
    try {
      secureLogger.info('Starting complete Demo1 enhanced router verification');

      const results = {
        basicRouting: await this.verifyBasicRouting(),
        multiKeyRotation: await this.verifyMultiKeyRotation(),
        demo1Logic: await this.verifyDemo1Logic(),
        keyFailureHandling: await this.verifyKeyFailureHandling()
      };

      const allPassed = Object.values(results).every(result => result === true);

      secureLogger.info('Complete verification results', {
        ...results,
        overallSuccess: allPassed
      });

      return allPassed;
    } catch (error: any) {
      secureLogger.error('Complete verification failed', { error: error.message });
      return false;
    }
  }
}

// 主执行函数
async function main() {
  try {
    const configPath = join(__dirname, '../config/test-demo1-enhanced.json');
    const verifier = new Demo1EnhancedVerifier(configPath);
    
    const success = await verifier.runCompleteVerification();
    
    if (success) {
      secureLogger.info('✅ All verifications passed - Demo1 enhanced router working correctly');
      process.exit(0);
    } else {
      secureLogger.error('❌ Some verifications failed - Please check logs');
      process.exit(1);
    }
  } catch (error: any) {
    secureLogger.error('Verification script failed', { error: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}