#!/usr/bin/env node

/**
 * Validate v4 configuration files
 */

const fs = require('fs');
const path = require('path');

// Simple validator implementation in JavaScript for immediate use
class SimpleV4ConfigValidator {
  constructor() {
    this.requiredRootFields = ['version', 'serverCompatibilityProviders', 'standardProviders', 'routing', 'security', 'validation'];
  }

  async validateConfig(configPath) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      configPath,
      validatedAt: new Date()
    };

    try {
      if (!fs.existsSync(configPath)) {
        result.valid = false;
        result.errors.push(`Configuration file not found: ${configPath}`);
        return result;
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      let config;
      
      try {
        config = JSON.parse(configContent);
      } catch (parseError) {
        result.valid = false;
        result.errors.push(`Invalid JSON format: ${parseError.message}`);
        return result;
      }

      // Basic validation
      this.validateBasicStructure(config, result);
      this.validateProviders(config, result);
      this.validateRouting(config, result);
      this.validateConsistency(config, result);

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation failed: ${error.message}`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  validateBasicStructure(config, result) {
    // Check version
    if (!config.version || !config.version.startsWith('4.0')) {
      result.errors.push(`Invalid version: expected 4.0.x, got ${config.version}`);
    }

    // Check required root fields
    for (const field of this.requiredRootFields) {
      if (!(field in config)) {
        result.errors.push(`Missing required root field: ${field}`);
      }
    }

    // Check server config
    if (config.server) {
      if (!config.server.port || typeof config.server.port !== 'number') {
        result.errors.push('Server port must be a number');
      }
      if (!config.server.host) {
        result.warnings.push('Server host not specified, defaulting to localhost');
      }
    }
  }

  validateProviders(config, result) {
    const serverCompat = config.serverCompatibilityProviders || {};
    const standard = config.standardProviders || {};
    const totalProviders = Object.keys(serverCompat).length + Object.keys(standard).length;

    if (totalProviders === 0) {
      result.errors.push('At least one provider must be configured');
      return;
    }

    // Validate server compatibility providers
    for (const [key, provider] of Object.entries(serverCompat)) {
      this.validateProvider(provider, 'server-compatibility', key, result);
    }

    // Validate standard providers
    for (const [key, provider] of Object.entries(standard)) {
      this.validateProvider(provider, 'standard', key, result);
    }

    result.suggestions.push(`Found ${totalProviders} provider(s) configured`);
  }

  validateProvider(provider, expectedType, key, result) {
    const prefix = `Provider ${key}:`;

    // Required fields
    const requiredFields = ['id', 'name', 'description', 'enabled', 'type', 'protocol', 'connection'];
    for (const field of requiredFields) {
      if (!(field in provider)) {
        result.errors.push(`${prefix} Missing required field: ${field}`);
      }
    }

    // Type validation
    if (provider.type && provider.type !== expectedType) {
      result.errors.push(`${prefix} Invalid type: expected ${expectedType}, got ${provider.type}`);
    }

    // Connection validation
    if (provider.connection) {
      if (!provider.connection.endpoint) {
        result.errors.push(`${prefix} Missing connection endpoint`);
      }
      if (!provider.connection.timeout || provider.connection.timeout <= 0) {
        result.errors.push(`${prefix} Invalid timeout value`);
      }
    }

    // Models validation
    if (provider.models) {
      if (!provider.models.supported || !Array.isArray(provider.models.supported)) {
        result.errors.push(`${prefix} Models.supported must be an array`);
      }
      if (!provider.models.default) {
        result.warnings.push(`${prefix} No default model specified`);
      }
    }

    // Authentication check
    if (provider.connection && provider.connection.authentication) {
      if (provider.connection.authentication.credentials) {
        const creds = provider.connection.authentication.credentials;
        if (creds.apiKey && typeof creds.apiKey === 'string' && creds.apiKey.startsWith('${')) {
          result.suggestions.push(`${prefix} Using environment variable for API key (recommended)`);
        } else if (creds.apiKeys && Array.isArray(creds.apiKeys)) {
          const envVarKeys = creds.apiKeys.filter(key => key.startsWith('${'));
          if (envVarKeys.length === creds.apiKeys.length) {
            result.suggestions.push(`${prefix} Using environment variables for API keys (recommended)`);
          } else {
            result.warnings.push(`${prefix} Some API keys appear to be hardcoded`);
          }
        }
      }
    }
  }

  validateRouting(config, result) {
    if (!config.routing) {
      result.errors.push('Missing routing configuration');
      return;
    }

    const routing = config.routing;

    // Pipeline architecture
    if (!routing.pipelineArchitecture) {
      result.errors.push('Missing pipelineArchitecture');
    } else {
      const arch = routing.pipelineArchitecture;
      if (!arch.layers || !Array.isArray(arch.layers)) {
        result.errors.push('PipelineArchitecture layers must be an array');
      } else {
        const expectedLayers = ['transformer', 'protocol', 'server-compatibility', 'server'];
        for (let i = 0; i < expectedLayers.length; i++) {
          const layer = arch.layers[i];
          if (!layer || layer.name !== expectedLayers[i] || layer.order !== i + 1) {
            result.errors.push(`Invalid layer at position ${i + 1}: expected ${expectedLayers[i]}`);
          }
        }
      }
    }

    // Routes
    if (!routing.routes || !Array.isArray(routing.routes)) {
      result.errors.push('Routes must be an array');
    } else if (routing.routes.length === 0) {
      result.errors.push('At least one route must be defined');
    }

    // Configuration
    if (!routing.configuration) {
      result.errors.push('Missing routing configuration');
    } else {
      const config = routing.configuration;
      if (typeof config.zeroFallbackPolicy !== 'boolean') {
        result.errors.push('zeroFallbackPolicy must be a boolean');
      }
      if (typeof config.strictErrorReporting !== 'boolean') {
        result.errors.push('strictErrorReporting must be a boolean');
      }

      // Fallback consistency check
      if (config.zeroFallbackPolicy && config.allowEmergencyFallback) {
        result.warnings.push('zeroFallbackPolicy with allowEmergencyFallback creates hybrid behavior');
      }
    }
  }

  validateConsistency(config, result) {
    // Check if routes reference existing providers
    if (config.routing && config.routing.routes) {
      const allProviders = {
        ...config.serverCompatibilityProviders,
        ...config.standardProviders
      };

      for (const route of config.routing.routes) {
        if (route.pipeline && route.pipeline.layers) {
          for (const layer of route.pipeline.layers) {
            if (layer.config && layer.config.providerId) {
              const providerId = layer.config.providerId;
              if (!allProviders[providerId]) {
                result.errors.push(`Route ${route.id}: Referenced provider '${providerId}' not found`);
              }
            }
          }
        }
      }
    }

    // Check model mappings
    if (config.routing && config.routing.routingRules && config.routing.routingRules.modelMapping) {
      const routes = config.routing.routes || [];
      const routeIds = routes.map(r => r.id);

      for (const [model, mapping] of Object.entries(config.routing.routingRules.modelMapping)) {
        if (mapping.preferredRoutes) {
          for (const routeId of mapping.preferredRoutes) {
            if (!routeIds.includes(routeId)) {
              result.errors.push(`Model mapping for '${model}': Referenced route '${routeId}' not found`);
            }
          }
        }
      }
    }
  }

  async validateConfigs(configPaths) {
    const results = [];
    
    for (const configPath of configPaths) {
      console.log(`🔍 Validating: ${path.basename(configPath)}`);
      const result = await this.validateConfig(configPath);
      results.push(result);
    }

    return this.generateReport(results);
  }

  generateReport(results) {
    const validConfigs = results.filter(r => r.valid).length;
    const invalidConfigs = results.length - validConfigs;

    return {
      totalConfigs: results.length,
      validConfigs,
      invalidConfigs,
      results
    };
  }
}

// Main execution
async function main() {
  const configDir = path.join(process.env.HOME, '.route-claudecode', 'config', 'v4');
  const configPaths = [];

  // Find all JSON config files
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
    console.log('❌ No v4 configuration files found in ~/.route-claudecode/config/v4/');
    console.log(`   Searched in: ${configDir}`);
    return;
  }

  console.log(`🔍 Found ${configPaths.length} configuration files\n`);

  const validator = new SimpleV4ConfigValidator();
  const report = await validator.validateConfigs(configPaths);

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RCC v4.0 Configuration Validation Report');
  console.log('═'.repeat(60));
  console.log(`📋 Total Configurations: ${report.totalConfigs}`);
  console.log(`✅ Valid Configurations: ${report.validConfigs}`);
  console.log(`❌ Invalid Configurations: ${report.invalidConfigs}`);
  
  const successRate = ((report.validConfigs / report.totalConfigs) * 100).toFixed(1);
  console.log(`📈 Success Rate: ${successRate}%\n`);

  // Detailed results
  for (const result of report.results) {
    const status = result.valid ? '✅' : '❌';
    const configName = path.basename(result.configPath);
    console.log(`${status} ${configName}`);
    
    if (result.errors.length > 0) {
      console.log(`   🔴 Errors (${result.errors.length}):`);
      for (const error of result.errors.slice(0, 5)) { // Show first 5 errors
        console.log(`      • ${error}`);
      }
      if (result.errors.length > 5) {
        console.log(`      ... and ${result.errors.length - 5} more errors`);
      }
    }
    
    if (result.warnings.length > 0) {
      console.log(`   🟡 Warnings (${result.warnings.length}):`);
      for (const warning of result.warnings.slice(0, 3)) { // Show first 3 warnings
        console.log(`      • ${warning}`);
      }
      if (result.warnings.length > 3) {
        console.log(`      ... and ${result.warnings.length - 3} more warnings`);
      }
    }
    
    if (result.suggestions.length > 0) {
      console.log(`   💡 Suggestions (${result.suggestions.length}):`);
      for (const suggestion of result.suggestions.slice(0, 2)) { // Show first 2 suggestions
        console.log(`      • ${suggestion}`);
      }
    }
    console.log('');
  }

  console.log('💡 Next Steps:');
  if (report.invalidConfigs > 0) {
    console.log('   1. Fix configuration errors before deployment');
    console.log('   2. Review and address all warnings');
  } else {
    console.log('   1. All configurations are valid! 🎉');
    console.log('   2. Consider addressing warnings for optimal performance');
  }
  console.log('   3. Test provider connectivity and functionality');
  console.log('   4. Perform end-to-end testing with tool calling');

  // Exit with error code if any configs are invalid
  if (report.invalidConfigs > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = { SimpleV4ConfigValidator };