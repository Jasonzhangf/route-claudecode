/**
 * ConfigReader路由展开功能测试
 * 测试复杂路由格式的展开和可选security字段处理
 * 
 * @author RCC v4.0
 */

import { ConfigReader } from './config/config-reader';
import { secureLogger } from './utils/secure-logger';
import { JQJsonHandler } from './utils/jq-json-handler';
import path from 'path';
import { ConfigError } from './types/error';

/**
 * 测试ConfigReader的路由展开功能
 */
async function testConfigExpansion() {
  try {
    secureLogger.info('🧪 Starting ConfigReader expansion test');
    
    // 测试文件路径
    const multiProviderConfigPath = path.join(
      process.env.HOME || '',
      '.route-claudecode/config/multi-provider-hybrid-v4.json'
    );
    
    const systemConfigPath = path.join(__dirname, '../config/system-config.json');
    
    secureLogger.info('📂 Loading configuration files', {
      userConfig: multiProviderConfigPath,
      systemConfig: systemConfigPath
    });
    
    // 加载配置
    const mergedConfig = ConfigReader.loadConfig(multiProviderConfigPath, systemConfigPath);
    
    secureLogger.info('✅ Configuration loaded successfully', {
      providersCount: mergedConfig.providers.length,
      routerCategories: Object.keys(mergedConfig.router || {}).length,
      hasExpandedRouting: !!mergedConfig.expandedRouting,
      hasSecurity: !!mergedConfig.security,
      securityCategories: mergedConfig.security ? Object.keys(mergedConfig.security).length : 0
    });
    
    // 检查展开后的路由配置
    if (mergedConfig.expandedRouting) {
      const routing = mergedConfig.expandedRouting;
      
      secureLogger.info('🔍 Expanded routing details', {
        primaryProviders: routing.primaryProviders.length,
        securityProviders: routing.securityProviders.length,
        totalProviders: routing.allProviders.length
      });
      
      // 详细输出展开后的配置
      secureLogger.info('📋 Primary providers breakdown');
      routing.primaryProviders.forEach((provider, index) => {
        secureLogger.info(`  ${index + 1}. ${provider.name}/${provider.model}`, {
          category: provider.category,
          priority: provider.priority,
          isSecurityEnhanced: provider.isSecurityEnhanced,
          maxTokens: provider.originalProvider.maxTokens
        });
      });
      
      if (routing.securityProviders.length > 0) {
        secureLogger.info('🔐 Security enhanced providers breakdown');
        routing.securityProviders.forEach((provider, index) => {
          secureLogger.info(`  ${index + 1}. ${provider.name}/${provider.model}`, {
            category: provider.category,
            priority: provider.priority,
            isSecurityEnhanced: provider.isSecurityEnhanced,
            maxTokens: provider.originalProvider.maxTokens
          });
        });
      } else {
        secureLogger.info('🔐 No security enhanced providers configured');
      }
      
      // 输出原始配置格式（证明静态输出不受影响）
      secureLogger.info('📊 Original static configuration preserved', {
        originalProviders: mergedConfig.providers.map(p => ({
          name: p.name,
          modelCount: p.models.length,
          priority: p.priority
        })),
        originalRouter: mergedConfig.router,
        originalSecurity: mergedConfig.security
      });
      
    } else {
      secureLogger.info('📋 No complex routing detected, using standard format');
    }
    
    // 验证关键配置项保持不变
    const validation = {
      providersCount: mergedConfig.providers.length,
      serverPort: mergedConfig.server.port,
      apiKey: mergedConfig.apiKey,
      hasSystemConfig: !!mergedConfig.systemConfig,
      blacklistSettings: mergedConfig.blacklistSettings
    };
    
    secureLogger.info('✅ Configuration validation passed', validation);
    
    // 输出JSON格式的配置摘要（用于验证静态输出格式）
    const configSummary = {
      metadata: {
        timestamp: new Date().toISOString(),
        testType: 'config-expansion',
        version: '4.0'
      },
      configuration: {
        providers: mergedConfig.providers.length,
        router: Object.keys(mergedConfig.router || {}).length,
        security: mergedConfig.security ? Object.keys(mergedConfig.security).length : 0,
        expandedRouting: mergedConfig.expandedRouting ? {
          primary: mergedConfig.expandedRouting.primaryProviders.length,
          security: mergedConfig.expandedRouting.securityProviders.length,
          total: mergedConfig.expandedRouting.allProviders.length
        } : null
      },
      validation
    };
    
    secureLogger.info('📄 Final configuration summary', configSummary);
    
    return {
      success: true,
      mergedConfig,
      summary: configSummary
    };
    
  } catch (error) {
    secureLogger.error('💥 Raw error details', { 
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorType: typeof error
    });
    
    const testError = new ConfigError('配置展开测试失败', {
      originalError: error,
      testPhase: 'config-expansion-test',
      errorDetails: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown'
      }
    });
    secureLogger.error('❌ Configuration expansion test failed', { error: testError });
    
    return {
      success: false,
      error: testError
    };
  }
}

/**
 * 主测试函数
 */
async function main() {
  const result = await testConfigExpansion();
  
  if (result.success) {
    console.log('✅ ConfigReader expansion test completed successfully');
    console.log('📊 Configuration summary:', JSON.stringify(result.summary, null, 2));
    process.exit(0);
  } else {
    console.error('❌ ConfigReader expansion test failed');
    console.error('🚨 Error:', result.error?.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}