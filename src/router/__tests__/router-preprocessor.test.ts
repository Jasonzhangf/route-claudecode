import * as fs from 'fs';
import * as path from 'path';
import { RouterPreprocessor } from '../router-preprocessor';
import { ConfigPreprocessor } from '../../config/config-preprocessor';

describe('RouterPreprocessor', () => {
  const testConfigPath = '/Users/fanzhang/.route-claudecode/config.json';
  const testOutputDir = path.join(__dirname, 'test-outputs');
  
  beforeAll(() => {
    if (\!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  test('应该成功处理路由表', async () => {
    // 先获取路由表
    const configResult = ConfigPreprocessor.preprocess(testConfigPath);
    expect(configResult.success).toBe(true);
    
    // 处理路由表
    const result = await RouterPreprocessor.preprocess(configResult.routingTable\!);
    
    // 保存结果
    fs.writeFileSync(
      path.join(testOutputDir, 'router-preprocessor-result.json'),
      JSON.stringify(result, null, 2)
    );
    
    if (result.pipelineConfigs) {
      fs.writeFileSync(
        path.join(testOutputDir, 'pipeline-configs.json'),
        JSON.stringify(result.pipelineConfigs, null, 2)
      );
    }
    
    expect(result.success).toBe(true);
    expect(result.pipelineConfigs).toBeDefined();
  });

  test('应该生成正确的流水线层配置', async () => {
    const configResult = ConfigPreprocessor.preprocess(testConfigPath);
    const result = await RouterPreprocessor.preprocess(configResult.routingTable\!);
    
    const pipelineConfigs = result.pipelineConfigs || [];
    expect(pipelineConfigs.length).toBeGreaterThan(0);
    
    for (const config of pipelineConfigs) {
      expect(config.layers).toBeDefined();
      expect(config.layers.length).toBe(6);
    }
  });
});
EOF < /dev/null