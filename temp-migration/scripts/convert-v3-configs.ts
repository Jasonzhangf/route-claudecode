#!/usr/bin/env npx tsx
/**
 * V3 Configuration Batch Converter
 * 批量转换~/.route-claudecode/config/v3/目录下所有配置文件
 * @author Jason Zhang
 */

import { convertV3ToRouterConfig } from '../src/v3/config/v3-to-router-config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { glob } from 'glob';

interface ConversionResult {
  file: string;
  status: 'success' | 'error';
  error?: string;
  routerConfig?: any;
}

async function convertAllV3Configs(): Promise<void> {
  console.log('🚀 Starting V3 Configuration Batch Conversion');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const v3ConfigDir = path.join(os.homedir(), '.route-claudecode/config/v3/');
  console.log(`📁 Scanning directory: ${v3ConfigDir}`);
  
  // Find all JSON files in the v3 config directory
  const configFiles = await glob('**/*.json', { 
    cwd: v3ConfigDir,
    absolute: true 
  });
  
  console.log(`📋 Found ${configFiles.length} configuration files:`);
  configFiles.forEach(file => {
    const relativePath = path.relative(v3ConfigDir, file);
    console.log(`   • ${relativePath}`);
  });
  console.log('');
  
  const results: ConversionResult[] = [];
  
  // Process each configuration file
  for (const configFile of configFiles) {
    const relativePath = path.relative(v3ConfigDir, configFile);
    console.log(`🔧 Converting: ${relativePath}`);
    
    try {
      // Check if file exists and is readable
      if (!fs.existsSync(configFile)) {
        throw new Error(`File not found: ${configFile}`);
      }
      
      // Read and validate JSON
      const fileContent = fs.readFileSync(configFile, 'utf8');
      let v3Config: any;
      
      try {
        v3Config = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON in ${relativePath}: ${parseError.message}`);
      }
      
      // Convert using our V3 converter
      const routerConfig = convertV3ToRouterConfig(configFile);
      
      // Validate conversion result
      if (!routerConfig.server || !routerConfig.providers || !routerConfig.routing) {
        throw new Error(`Conversion failed - missing required sections`);
      }
      
      const providerCount = typeof routerConfig.providers === 'object' 
        ? Object.keys(routerConfig.providers).length 
        : 0;
      
      const routingCount = typeof routerConfig.routing === 'object'
        ? Object.keys(routerConfig.routing).length 
        : 0;
      
      console.log(`   ✅ Success: ${providerCount} providers, ${routingCount} routes, port ${routerConfig.server.port}`);
      
      results.push({
        file: relativePath,
        status: 'success',
        routerConfig
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Failed: ${errorMessage}`);
      
      results.push({
        file: relativePath,
        status: 'error',
        error: errorMessage
      });
    }
  }
  
  console.log('');
  console.log('📊 Conversion Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');
  
  console.log(`✅ Successful conversions: ${successful.length}`);
  successful.forEach(result => {
    const config = result.routerConfig;
    const providerCount = Object.keys(config.providers).length;
    const routingCount = Object.keys(config.routing).length;
    console.log(`   • ${result.file} → ${providerCount} providers, ${routingCount} routes, port ${config.server.port}`);
  });
  
  if (failed.length > 0) {
    console.log(`❌ Failed conversions: ${failed.length}`);
    failed.forEach(result => {
      console.log(`   • ${result.file}: ${result.error}`);
    });
  }
  
  // Generate validation report
  console.log('');
  console.log('🎯 Validation Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (successful.length > 0) {
    const portUsage = new Map<number, string[]>();
    const providerTypes = new Set<string>();
    
    successful.forEach(result => {
      const config = result.routerConfig;
      const port = config.server.port;
      
      if (!portUsage.has(port)) {
        portUsage.set(port, []);
      }
      portUsage.get(port)!.push(result.file);
      
      Object.values(config.providers).forEach((provider: any) => {
        providerTypes.add(provider.type);
      });
    });
    
    console.log(`🌐 Port assignments (${portUsage.size} unique ports):`);
    Array.from(portUsage.entries()).sort(([a], [b]) => a - b).forEach(([port, files]) => {
      if (files.length === 1) {
        console.log(`   • Port ${port}: ${files[0]}`);
      } else {
        console.log(`   • Port ${port}: ${files.length} configurations (CONFLICT!)`);
        files.forEach(file => console.log(`     - ${file}`));
      }
    });
    
    console.log(`🔌 Provider types (${providerTypes.size} types): ${Array.from(providerTypes).join(', ')}`);
    
    // Check for port conflicts
    const conflicts = Array.from(portUsage.entries()).filter(([_, files]) => files.length > 1);
    if (conflicts.length > 0) {
      console.log(`⚠️ Port conflicts detected: ${conflicts.length} ports have multiple configurations`);
    } else {
      console.log(`✅ No port conflicts detected`);
    }
  }
  
  console.log('');
  console.log('🎉 V3 Configuration Batch Conversion Complete');
  console.log(`📊 Results: ${successful.length} successful, ${failed.length} failed`);
  
  if (failed.length === 0) {
    console.log('🚀 All configurations are ready for V3 usage with rcc3 command!');
    console.log('');
    console.log('💡 Usage examples:');
    successful.slice(0, 3).forEach(result => {
      const config = result.routerConfig;
      const configPath = path.join(v3ConfigDir, result.file);
      console.log(`   rcc3 start --config "${configPath}" --debug`);
    });
  }
}

// Utility function for expanding ~ in paths (not needed since we use os.homedir())

// Run the conversion
if (import.meta.url === `file://${process.argv[1]}`) {
  convertAllV3Configs().catch(error => {
    console.error('❌ Batch conversion failed:', error.message);
    process.exit(1);
  });
}