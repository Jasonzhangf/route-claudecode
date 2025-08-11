#!/usr/bin/env node

/**
 * 检查服务器状态和provider健康状况
 */

const axios = require('axios');

async function checkServerStatus() {
  const statusUrl = 'http://127.0.0.1:3456/status';
  
  try {
    console.log('🔍 Checking server status...');
    const response = await axios.get(statusUrl);
    
    console.log('📊 Server Information:');
    console.log(`   Version: ${response.data.version}`);
    console.log(`   Uptime: ${Math.round(response.data.uptime)}s`);
    console.log(`   Debug: ${response.data.debug}`);
    
    console.log('\n🔧 Available Providers:');
    response.data.providers.forEach(provider => {
      console.log(`   - ${provider}`);
    });
    
    console.log('\n🚦 Provider Health:');
    const routing = response.data.routing;
    if (routing && routing.providerHealth) {
      Object.keys(routing.providerHealth).forEach(providerId => {
        const health = routing.providerHealth[providerId];
        const status = health.isHealthy ? '✅ Healthy' : '❌ Unhealthy';
        const errorCount = health.consecutiveErrors || 0;
        const isBlacklisted = health.isBlacklisted ? ' (Blacklisted)' : '';
        const isDisabled = health.isTemporarilyDisabledByUser ? ' (Disabled)' : '';
        
        console.log(`   ${providerId}: ${status} (${errorCount} errors)${isBlacklisted}${isDisabled}`);
      });
    }
    
    console.log('\n📈 Routing Categories:');
    if (routing && routing.categories) {
      Object.keys(routing.categories).forEach(category => {
        const categoryData = routing.categories[category];
        console.log(`   ${category}: ${categoryData.provider} (${categoryData.model})`);
      });
    }
    
  } catch (error) {
    console.log('❌ Failed to get server status');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.log('   Network error - server may not be running');
      console.log(`   Error: ${error.message}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
}

// 运行检查
checkServerStatus().catch(console.error);