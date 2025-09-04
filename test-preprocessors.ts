import * as fs from 'fs';
import * as path from 'path';
import { ConfigPreprocessor } from './src/config/config-preprocessor';
import { RouterPreprocessor } from './src/router/router-preprocessor';

async function testPreprocessors() {
  const testConfigPath = '/Users/fanzhang/.route-claudecode/config.json';
  const outputDir = './test-outputs';
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Test ConfigPreprocessor
  const configResult = ConfigPreprocessor.preprocess(testConfigPath);
  
  fs.writeFileSync(
    path.join(outputDir, 'config-preprocessor-result.json'),
    JSON.stringify(configResult, null, 2)
  );
  
  if (configResult.routingTable) {
    fs.writeFileSync(
      path.join(outputDir, 'routing-table.json'),
      JSON.stringify(configResult.routingTable, null, 2)
    );
    
    // Test RouterPreprocessor
    const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable);
    
    fs.writeFileSync(
      path.join(outputDir, 'router-preprocessor-result.json'),
      JSON.stringify(routerResult, null, 2)
    );
    
    if (routerResult.pipelineConfigs) {
      fs.writeFileSync(
        path.join(outputDir, 'pipeline-configs.json'),
        JSON.stringify(routerResult.pipelineConfigs, null, 2)
      );
    }
    
    if (routerResult.routingTable) {
      fs.writeFileSync(
        path.join(outputDir, 'internal-routing-table.json'),
        JSON.stringify(routerResult.routingTable, null, 2)
      );
    }
    
    // Validation summary
    const summary = {
      configProcessingSuccess: configResult.success,
      routerProcessingSuccess: routerResult.success,
      providersCount: configResult.routingTable.providers.length,
      routesCount: Object.keys(configResult.routingTable.routes).length,
      pipelinesCount: routerResult.stats?.pipelinesCount || 0,
      totalProcessingTime: configResult.metadata.processingTime + (routerResult.stats?.processingTimeMs || 0)
    };
    
    fs.writeFileSync(
      path.join(outputDir, 'test-summary.json'),
      JSON.stringify(summary, null, 2)
    );
  }
}

testPreprocessors();