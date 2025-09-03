import { UnifiedConfigManager } from '../config/unified-config-manager';
import * as path from 'path';
import * as os from 'os';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

async function runTest() {
  const outputDir = './test-output';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const configManager = new UnifiedConfigManager();
  const configPath = path.join(os.homedir(), '.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511.json');
  
  const config = await configManager.loadConfiguration(configPath);
  
  const outputData = {
    providers: config.provider.providers.length,
    routingRules: Object.keys(config.router.routingRules.modelMapping).length,
    port: config.server.port
  };
  
  writeFileSync('./test-output/config-output.json', JSON.stringify(outputData, null, 2));
}

runTest();