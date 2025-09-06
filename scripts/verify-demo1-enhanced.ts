/**
 * Demo1增强版路由器验证脚本
 * 验证多key轮询功能是否正常工作
 */

import { Demo1EnhancedRouter } from '../src/router/demo1-enhanced-router';
import { secureLogger } from '../src/utils/secure-logger';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseJsonString } from '../src/utils/jq-json-handler';

class Demo1EnhancedVerifier {
  private router: Demo1EnhancedRouter;
  private config: any;

  constructor(configPath: string) {
    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    this.config = parseJsonString(readFileSync(configPath, 'utf-8'));
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