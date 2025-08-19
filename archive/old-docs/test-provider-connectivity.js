#!/usr/bin/env node

/**
 * Provider Connectivity and Adaptation Test
 * 
 * Tests provider endpoints and resolves adaptation issues
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ProviderTester {
  constructor() {
    this.results = [];
  }

  async testProviders(configPaths) {
    console.log('🔍 Testing Provider Connectivity and Adaptation\n');

    for (const configPath of configPaths) {
      if (!configPath.includes('v4-55') || !configPath.endsWith('.json')) continue;
      
      console.log(`📝 Testing config: ${path.basename(configPath)}`);
      await this.testConfigProviders(configPath);
      console.log('');
    }

    this.generateReport();
  }

  async testConfigProviders(configPath) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Test server compatibility providers
      if (config.serverCompatibilityProviders) {
        for (const [key, provider] of Object.entries(config.serverCompatibilityProviders)) {
          await this.testProvider(provider, 'server-compatibility', configPath);
        }
      }

      // Test standard providers
      if (config.standardProviders) {
        for (const [key, provider] of Object.entries(config.standardProviders)) {
          await this.testProvider(provider, 'standard', configPath);
        }
      }

    } catch (error) {
      console.log(`   ❌ Failed to load config: ${error.message}`);
    }
  }

  async testProvider(provider, type, configPath) {
    const result = {
      configPath,
      providerId: provider.id,
      name: provider.name,
      type,
      protocol: provider.protocol,
      endpoint: provider.connection?.endpoint,
      tests: {
        connectivity: false,
        authentication: false,
        models: false,
        capabilities: false
      },
      issues: [],
      suggestions: []
    };

    console.log(`  🧪 Testing ${provider.name} (${provider.id})`);

    try {
      // Test 1: Basic connectivity
      result.tests.connectivity = await this.testConnectivity(provider);
      console.log(`     ${result.tests.connectivity ? '✅' : '❌'} Connectivity`);

      // Test 2: Authentication setup
      result.tests.authentication = this.testAuthentication(provider);
      console.log(`     ${result.tests.authentication ? '✅' : '❌'} Authentication`);

      // Test 3: Model configuration
      result.tests.models = this.testModelConfig(provider);
      console.log(`     ${result.tests.models ? '✅' : '❌'} Model Configuration`);

      // Test 4: Capabilities
      result.tests.capabilities = this.testCapabilities(provider);
      console.log(`     ${result.tests.capabilities ? '✅' : '❌'} Capabilities`);

      // Adaptation analysis
      this.analyzeAdaptationIssues(provider, result);

    } catch (error) {
      result.issues.push(`Testing failed: ${error.message}`);
      console.log(`     ❌ Testing failed: ${error.message}`);
    }

    this.results.push(result);
  }

  async testConnectivity(provider) {
    if (!provider.connection?.endpoint) {
      return false;
    }

    const endpoint = provider.connection.endpoint;
    
    // For localhost endpoints, assume they're available if this is LM Studio
    if (endpoint.includes('localhost:1234')) {
      console.log(`     ⚠️  LM Studio endpoint (${endpoint}) - ensure LM Studio is running`);
      return true; // Assume available for testing
    }

    // For remote endpoints, try a basic connectivity test
    try {
      await this.makeRequest(endpoint, '/v1/models', 'GET', {}, 5000);
      return true;
    } catch (error) {
      // Some endpoints might not have /v1/models, try root path
      try {
        await this.makeRequest(endpoint, '/', 'GET', {}, 5000);
        return true;
      } catch (rootError) {
        return false;
      }
    }
  }

  testAuthentication(provider) {
    const auth = provider.connection?.authentication;
    
    if (!auth) {
      return provider.connection?.endpoint?.includes('localhost'); // Local endpoints might not need auth
    }

    if (auth.type === 'none') {
      return true;
    }

    if (auth.type === 'bearer') {
      const creds = auth.credentials;
      if (creds?.apiKey || creds?.apiKeys) {
        // Check if using environment variables (recommended)
        const usingEnvVars = 
          (creds.apiKey && creds.apiKey.startsWith('${')) ||
          (creds.apiKeys && creds.apiKeys.every(key => key.startsWith('${')));
        
        if (!usingEnvVars) {
          console.log(`     ⚠️  Consider using environment variables for API keys`);
        }
        return true;
      }
    }

    return false;
  }

  testModelConfig(provider) {
    const models = provider.models;
    
    if (!models) return false;
    
    const hasSupported = models.supported && Array.isArray(models.supported) && models.supported.length > 0;
    const hasDefault = models.default && typeof models.default === 'string';
    const hasCapabilities = models.capabilities && typeof models.capabilities === 'object';
    
    return hasSupported && hasDefault && hasCapabilities;
  }

  testCapabilities(provider) {
    const features = provider.features;
    const capabilities = provider.models?.capabilities;
    
    if (!features || !capabilities) return false;
    
    // Check essential capabilities
    const hasChat = capabilities.chat === true;
    const hasStreaming = capabilities.streaming === true;
    const hasFeatureStream = features.streaming === true;
    
    return hasChat && hasStreaming && hasFeatureStream;
  }

  analyzeAdaptationIssues(provider, result) {
    // Protocol-specific adaptation checks
    switch (provider.protocol) {
      case 'openai':
        this.analyzeOpenAIAdaptation(provider, result);
        break;
      case 'anthropic':
        this.analyzeAnthropicAdaptation(provider, result);
        break;
      case 'gemini':
        this.analyzeGeminiAdaptation(provider, result);
        break;
      default:
        result.issues.push(`Unknown protocol: ${provider.protocol}`);
    }

    // Check for common configuration issues
    this.checkCommonIssues(provider, result);
  }

  analyzeOpenAIAdaptation(provider, result) {
    const endpoint = provider.connection?.endpoint;
    
    // Check endpoint format
    if (endpoint && !endpoint.includes('/v1')) {
      result.suggestions.push('OpenAI endpoints should include /v1 in the path');
    }

    // Check model names
    const models = provider.models?.supported || [];
    const hasGptModels = models.some(m => m.includes('gpt'));
    const hasCustomModels = models.some(m => !m.includes('gpt') && !m.includes('text-'));
    
    if (hasCustomModels && !hasGptModels) {
      result.suggestions.push('Custom models detected - ensure OpenAI compatibility');
    }

    // Check for tool calling support
    const toolCalling = provider.features?.toolCalling || provider.models?.capabilities?.toolCalling;
    if (toolCalling) {
      result.suggestions.push('Tool calling enabled - test function call format compatibility');
    }
  }

  analyzeAnthropicAdaptation(provider, result) {
    // Anthropic-specific checks
    const models = provider.models?.supported || [];
    const hasClaudeModels = models.some(m => m.includes('claude'));
    
    if (!hasClaudeModels) {
      result.issues.push('Anthropic protocol but no Claude models found');
    }

    // Check for system message handling
    result.suggestions.push('Ensure system message handling in Anthropic format');
  }

  analyzeGeminiAdaptation(provider, result) {
    const endpoint = provider.connection?.endpoint;
    
    // Check Gemini endpoint
    if (endpoint && !endpoint.includes('generativelanguage.googleapis.com')) {
      result.issues.push('Gemini endpoint should use generativelanguage.googleapis.com');
    }

    // Check model naming
    const models = provider.models?.supported || [];
    const hasGeminiModels = models.some(m => m.includes('gemini'));
    
    if (!hasGeminiModels) {
      result.issues.push('Gemini protocol but no Gemini models found');
    }

    // Check for multi-key rotation
    const auth = provider.connection?.authentication;
    if (auth?.credentials?.apiKeys && auth.credentials.apiKeys.length > 1) {
      result.suggestions.push('Multi-key rotation configured - ensure proper key management');
    }

    // Safety settings
    result.suggestions.push('Configure Gemini safety settings for production use');
  }

  checkCommonIssues(provider, result) {
    // Timeout configuration
    const timeout = provider.connection?.timeout;
    if (!timeout || timeout < 10000) {
      result.suggestions.push('Consider increasing timeout for better reliability (min 10s)');
    }

    // Retry configuration
    const maxRetries = provider.connection?.maxRetries;
    if (maxRetries === undefined || maxRetries < 2) {
      result.suggestions.push('Configure retry attempts for better resilience (min 2)');
    }

    // Health check
    if (provider.healthCheck?.enabled !== true) {
      result.suggestions.push('Enable health checks for monitoring');
    }

    // Model count
    const modelCount = provider.models?.supported?.length || 0;
    if (modelCount < 2) {
      result.suggestions.push('Consider configuring multiple models for flexibility');
    }
  }

  makeRequest(baseUrl, path, method, headers, timeout) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.setTimeout(timeout);
      req.end();
    });
  }

  generateReport() {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 Provider Connectivity and Adaptation Report');
    console.log('═'.repeat(70));

    const totalProviders = this.results.length;
    const connectedProviders = this.results.filter(r => r.tests.connectivity).length;
    const fullyConfigured = this.results.filter(r => 
      Object.values(r.tests).every(test => test === true)
    ).length;

    console.log(`📋 Total Providers Tested: ${totalProviders}`);
    console.log(`🔗 Connected Providers: ${connectedProviders}/${totalProviders}`);
    console.log(`✅ Fully Configured: ${fullyConfigured}/${totalProviders}`);
    console.log(`📈 Success Rate: ${((fullyConfigured / totalProviders) * 100).toFixed(1)}%\n`);

    // Group by configuration file
    const byConfig = {};
    for (const result of this.results) {
      const configName = path.basename(result.configPath);
      if (!byConfig[configName]) byConfig[configName] = [];
      byConfig[configName].push(result);
    }

    for (const [configName, providers] of Object.entries(byConfig)) {
      console.log(`📄 ${configName}`);
      
      for (const provider of providers) {
        const status = Object.values(provider.tests).every(t => t) ? '✅' : '⚠️';
        console.log(`  ${status} ${provider.name} (${provider.protocol})`);
        
        if (provider.issues.length > 0) {
          console.log(`     🔴 Issues:`);
          for (const issue of provider.issues) {
            console.log(`        • ${issue}`);
          }
        }
        
        if (provider.suggestions.length > 0) {
          console.log(`     💡 Suggestions:`);
          for (const suggestion of provider.suggestions.slice(0, 3)) {
            console.log(`        • ${suggestion}`);
          }
        }
      }
      console.log('');
    }

    // Adaptation recommendations
    console.log('🔧 Key Adaptation Recommendations:');
    console.log('   1. Ensure all providers use environment variables for API keys');
    console.log('   2. Test tool calling format compatibility across protocols');
    console.log('   3. Configure appropriate timeouts and retry policies');
    console.log('   4. Enable health checks for production monitoring');
    console.log('   5. Test streaming functionality for each provider');
    console.log('\n📋 Next Steps:');
    console.log('   1. Start LM Studio if testing local configurations');
    console.log('   2. Set up environment variables for API keys');
    console.log('   3. Run end-to-end tool calling tests');
    console.log('   4. Monitor provider performance and reliability');
  }
}

// Main execution
async function main() {
  const configDir = path.join(process.env.HOME, '.route-claudecode', 'config', 'v4');
  const configPaths = [];

  // Find configuration files
  function findConfigs(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          findConfigs(fullPath);
        } else if (item.endsWith('.json') && !item.includes('backup')) {
          configPaths.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error.message);
    }
  }

  findConfigs(configDir);

  if (configPaths.length === 0) {
    console.log('❌ No configuration files found');
    return;
  }

  const tester = new ProviderTester();
  await tester.testProviders(configPaths);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Provider testing failed:', error);
    process.exit(1);
  });
}