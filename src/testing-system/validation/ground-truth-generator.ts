/**
 * 真值生成器 - 完整实现
 * 使用多种验证方式生成测试用例的标准答案
 */

import { EventEmitter } from 'events';
import { getEnhancedErrorHandler, ValidationError } from '../../modules/error-handler/src/enhanced-error-handler';
import { secureLogger } from '../../modules/error-handler/src/utils/secure-logger';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import fetch from 'node-fetch';
import { BOOTSTRAP_CONSTANTS } from '../../modules/constants/src/bootstrap-constants';

// 置信度评分
export interface ConfidenceScore {
  overall: number;
  components: {
    dataQuality: number;
    referenceReliability: number;
    validationCoverage: number;
    historicalConsistency: number;
  };
  factors: string[];
}

// 真值生成结果
export interface GroundTruthResult {
  expectedOutput: any;
  confidence: ConfidenceScore;
  validationMethod: string;
  generatedAt: string;
  referenceData: {
    claudeRouterResult?: any;
    historicalResults?: any[];
    manualValidation?: any;
    ruleBasedResult?: any;
  };
  metadata: Record<string, any>;
}

// 验证方法配置
export interface ValidationMethodConfig {
  claudeRouterComparison: {
    enabled: boolean;
    weight: number;
    endpoint?: string;
    timeout?: number;
    apiKey?: string;
    defaultModel?: string;
  };
  historicalComparison: {
    enabled: boolean;
    weight: number;
    minimumSamples: number;
    timeWindow: string;
  };
  ruleBasedValidation: {
    enabled: boolean;
    weight: number;
    strictMode: boolean;
    coverageRequirement: number;
  };
  manualValidation: {
    enabled: boolean;
    weight: number;
    validatorId?: string;
  };
}

// Ground Truth生成器错误类型
class GroundTruthGenerationError extends ValidationError {
  constructor(message: string, details?: any) {
    super(`Ground truth generation failed: ${message}`, details);
  }
}

class HistoricalDataError extends ValidationError {
  constructor(message: string, details?: any) {
    super(`Historical data error: ${message}`, details);
  }
}

class ValidationMethodError extends ValidationError {
  constructor(method: string, message: string, details?: any) {
    super(`Validation method '${method}' failed: ${message}`, { method, ...details });
  }
}

/**
 * 真值生成器实现
 */
export class GroundTruthGenerator extends EventEmitter {
  private config: ValidationMethodConfig;
  private errorHandler = getEnhancedErrorHandler();
  private historicalDataPath: string;
  private manualValidationPath: string;

  constructor(
    config: ValidationMethodConfig,
    dataStoragePaths?: {
      historicalData?: string;
      manualValidation?: string;
    }
  ) {
    super();
    
    this.config = {
      claudeRouterComparison: {
        enabled: true,
        weight: 0.7,
        timeout: 30000,
        defaultModel: BOOTSTRAP_CONSTANTS.PROVIDERS.ANTHROPIC.DEFAULT_MODEL,
        ...config.claudeRouterComparison
      },
      historicalComparison: {
        enabled: true,
        weight: 0.2,
        minimumSamples: 10,
        timeWindow: '30days',
        ...config.historicalComparison
      },
      ruleBasedValidation: {
        enabled: true,
        weight: 0.1,
        strictMode: true,
        coverageRequirement: 0.9,
        ...config.ruleBasedValidation
      },
      manualValidation: {
        enabled: false,
        weight: 0.0,
        ...config.manualValidation
      }
    };

    this.historicalDataPath = dataStoragePaths?.historicalData || 
      join(process.cwd(), 'test-data', 'historical');
    this.manualValidationPath = dataStoragePaths?.manualValidation || 
      join(process.cwd(), 'test-data', 'manual');

    this.initializeStorage();
  }

  /**
   * 初始化存储目录
   */
  private async initializeStorage(): Promise<void> {
    await fs.mkdir(this.historicalDataPath, { recursive: true });
    await fs.mkdir(this.manualValidationPath, { recursive: true });
  }

  /**
   * 生成真值
   */
  public async generateGroundTruth(
    input: any,
    testContext?: {
      testId: string;
      category: string;
      expectedBehavior?: string;
    }
  ): Promise<GroundTruthResult> {
    const startTime = Date.now();
    
    secureLogger.info('Starting ground truth generation', { 
      testId: testContext?.testId,
      category: testContext?.category 
    });

    const referenceData: GroundTruthResult['referenceData'] = {};
    const validationResults: Array<{
      method: string;
      result: any;
      confidence: number;
      weight: number;
    }> = [];

    // 1. Claude Router对比验证
    if (this.config.claudeRouterComparison.enabled) {
      const claudeResult = await this.validateWithClaudeRouter(input, testContext);
      if (claudeResult) {
        referenceData.claudeRouterResult = claudeResult.result;
        validationResults.push({
          method: 'claude_router',
          result: claudeResult.result,
          confidence: claudeResult.confidence,
          weight: this.config.claudeRouterComparison.weight
        });
      }
    }

    // 2. 历史数据对比验证
    if (this.config.historicalComparison.enabled) {
      const historicalResult = await this.validateWithHistoricalData(input, testContext);
      if (historicalResult) {
        referenceData.historicalResults = historicalResult.results;
        validationResults.push({
          method: 'historical',
          result: historicalResult.consensusResult,
          confidence: historicalResult.confidence,
          weight: this.config.historicalComparison.weight
        });
      }
    }

    // 3. 规则验证
    if (this.config.ruleBasedValidation.enabled) {
      const ruleResult = await this.validateWithRules(input, testContext);
      if (ruleResult) {
        referenceData.ruleBasedResult = ruleResult.result;
        validationResults.push({
          method: 'rule_based',
          result: ruleResult.result,
          confidence: ruleResult.confidence,
          weight: this.config.ruleBasedValidation.weight
        });
      }
    }

    // 4. 人工验证（如果可用）
    if (this.config.manualValidation.enabled) {
      const manualResult = await this.validateWithManualData(input, testContext);
      if (manualResult) {
        referenceData.manualValidation = manualResult.result;
        validationResults.push({
          method: 'manual',
          result: manualResult.result,
          confidence: manualResult.confidence,
          weight: this.config.manualValidation.weight
        });
      }
    }

    // 合成最终结果
    const finalResult = this.synthesizeResults(validationResults);
    const confidenceScore = this.calculateConfidence(validationResults);

    const groundTruth: GroundTruthResult = {
      expectedOutput: finalResult.output,
      confidence: confidenceScore,
      validationMethod: finalResult.primaryMethod,
      generatedAt: new Date().toISOString(),
      referenceData,
      metadata: {
        generationTime: Date.now() - startTime,
        methodsUsed: validationResults.map(r => r.method),
        totalMethods: validationResults.length,
        testContext
      }
    };

    secureLogger.info('Ground truth generation completed', {
      testId: testContext?.testId,
      confidence: confidenceScore.overall,
      methodsUsed: validationResults.length
    });

    this.emit('groundTruthGenerated', groundTruth);
    return groundTruth;
  }

  /**
   * Claude Router验证 - 实际HTTP请求实现
   */
  private async validateWithClaudeRouter(
    input: any,
    testContext?: any
  ): Promise<{ result: any; confidence: number } | null> {
    if (!this.config.claudeRouterComparison.endpoint) {
      secureLogger.warn('Claude Router endpoint not configured, skipping validation');
      return null;
    }

    const requestId = `claude-validation-${Date.now()}`;
    const startTime = Date.now();

    const result = await this.makeClaudeRouterRequest(input);
    const responseTime = Date.now() - startTime;

    if (result.success) {
      const confidence = this.calculateClaudeRouterConfidence(result.data, responseTime);
      
      secureLogger.debug('Claude Router validation completed', {
        requestId,
        responseTime,
        confidence
      });

      return { result: result.data, confidence };
    }

    await this.errorHandler.handleRCCError(
      new ValidationMethodError('claude_router', result.error || 'Request failed'),
      { requestId }
    );

    return null;
  }

  /**
   * 实际的Claude Router HTTP请求
   */
  private async makeClaudeRouterRequest(input: any): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    const endpoint = this.config.claudeRouterComparison.endpoint!;
    const timeout = this.config.claudeRouterComparison.timeout || 30000;

    const requestBody = {
      model: input.model || this.config.claudeRouterComparison.defaultModel,
      messages: Array.isArray(input.messages) ? input.messages : [
        { role: 'user', content: JSON.stringify(input) }
      ],
      max_tokens: input.max_tokens || 4000,
      temperature: input.temperature || 0.7
    };

    const response = await Promise.race([
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.claudeRouterComparison.apiKey || 'default-key'}`,
          'X-API-Key': this.config.claudeRouterComparison.apiKey || 'default-key'
        },
        body: JSON.stringify(requestBody)
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new ValidationError('Request timeout')), timeout)
      )
    ]).catch(error => {
      secureLogger.error('Claude Router request failed', {
        error: error.message,
        endpoint
      });
      return null;
    });

    if (!response) {
      return { success: false, error: 'Network request failed' };
    }

    if (!response.ok) {
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }

    const data = await response.json();
    return { success: true, data };
  }

  /**
   * 计算Claude Router置信度
   */
  private calculateClaudeRouterConfidence(result: any, responseTime: number): number {
    let confidence = 0.8;

    if (responseTime < 5000) confidence += 0.1;
    if (responseTime > 15000) confidence -= 0.2;

    if (result?.choices?.[0]?.message) confidence += 0.1;
    if (result?.usage) confidence += 0.05;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 历史数据验证
   */
  private async validateWithHistoricalData(
    input: any,
    testContext?: any
  ): Promise<{ results: any[]; consensusResult: any; confidence: number } | null> {
    const inputHash = this.generateInputHash(input);
    const historicalFile = join(this.historicalDataPath, `${inputHash}.json`);

    const historicalData = await fs.readFile(historicalFile, 'utf-8').catch(error => {
      if (error.code !== 'ENOENT') {
        this.errorHandler.handleRCCError(
          new HistoricalDataError('Failed to read historical data', { error: error.message }),
          { requestId: `ground-truth-${Date.now()}`, inputHash }
        );
      }
      return null;
    });
    
    if (!historicalData) {
      secureLogger.debug('No historical data found', { inputHash });
      return null;
    }

    const parsedData = JSON.parse(historicalData);
    const results = parsedData.results || [];

    if (results.length < this.config.historicalComparison.minimumSamples) {
      secureLogger.warn('Insufficient historical samples', { 
        available: results.length,
        required: this.config.historicalComparison.minimumSamples 
      });
      return null;
    }

    const consensusResult = this.calculateConsensus(results);
    const confidence = this.calculateHistoricalConfidence(results);

    return { results, consensusResult, confidence };
  }

  /**
   * 规则验证 - 基于实际业务规则
   */
  private async validateWithRules(
    input: any,
    testContext?: any
  ): Promise<{ result: any; confidence: number } | null> {
    const rules = await this.loadValidationRules(testContext?.category);
    
    if (!rules || rules.length === 0) {
      secureLogger.debug('No validation rules found', { category: testContext?.category });
      return null;
    }

    const ruleResults = [];
    let passedRules = 0;

    for (const rule of rules) {
      const ruleResult = this.applyRule(rule, input);
      ruleResults.push(ruleResult);
      if (ruleResult.passed) passedRules++;
    }

    const coverage = passedRules / rules.length;
    if (coverage < this.config.ruleBasedValidation.coverageRequirement) {
      secureLogger.warn('Rule validation coverage insufficient', { 
        coverage,
        required: this.config.ruleBasedValidation.coverageRequirement 
      });
      return null;
    }

    const result = this.generateRuleBasedResult(ruleResults, input);
    const confidence = coverage * 0.9;

    return { result, confidence };
  }

  /**
   * 人工验证数据查找
   */
  private async validateWithManualData(
    input: any,
    testContext?: any
  ): Promise<{ result: any; confidence: number } | null> {
    const inputHash = this.generateInputHash(input);
    const manualFile = join(this.manualValidationPath, `${inputHash}.json`);

    const manualData = await fs.readFile(manualFile, 'utf-8').catch(() => null);
    
    if (!manualData) {
      return null;
    }

    const parsedData = JSON.parse(manualData);
    return {
      result: parsedData.expectedResult,
      confidence: parsedData.confidence || 0.95
    };
  }

  /**
   * 保存历史验证结果
   */
  public async saveHistoricalResult(input: any, result: any): Promise<void> {
    const inputHash = this.generateInputHash(input);
    const historicalFile = join(this.historicalDataPath, `${inputHash}.json`);

    const existingData = await fs.readFile(historicalFile, 'utf-8').catch(() => '{}');
    const parsedData = JSON.parse(existingData);
    
    if (!parsedData.results) {
      parsedData.results = [];
    }

    parsedData.results.push({
      result,
      timestamp: new Date().toISOString(),
      hash: inputHash
    });

    if (parsedData.results.length > 100) {
      parsedData.results = parsedData.results.slice(-100);
    }

    await fs.writeFile(historicalFile, JSON.stringify(parsedData, null, 2));
    
    secureLogger.debug('Historical result saved', { inputHash });
  }

  /**
   * 辅助方法实现
   */
  private generateInputHash(input: any): string {
    const inputStr = JSON.stringify(input);
    return createHash('sha256').update(inputStr).digest('hex').substring(0, 32);
  }

  private calculateConsensus(results: any[]): any {
    const frequency = new Map();
    for (const result of results) {
      const key = JSON.stringify(result.result);
      frequency.set(key, (frequency.get(key) || 0) + 1);
    }
    
    let maxCount = 0;
    let consensusResult = results[0]?.result;
    
    for (const [key, count] of frequency) {
      if (count > maxCount) {
        maxCount = count;
        consensusResult = JSON.parse(key);
      }
    }
    
    return consensusResult;
  }

  private calculateHistoricalConfidence(results: any[]): number {
    const consistency = results.length > 1 ? 0.8 : 0.6;
    return Math.min(1, consistency + (results.length * 0.02));
  }

  private async loadValidationRules(category?: string): Promise<any[]> {
    const rulesFile = join(process.cwd(), 'test-rules', `${category || 'default'}.json`);
    const rulesData = await fs.readFile(rulesFile, 'utf-8').catch(() => null);
    
    if (!rulesData) {
      return this.getDefaultRules();
    }

    return JSON.parse(rulesData).rules || [];
  }

  private getDefaultRules(): any[] {
    return [
      {
        name: 'structure_validation',
        condition: (input: any) => typeof input === 'object' && input !== null,
        expectedResult: { validated: true, structure: 'valid' }
      },
      {
        name: 'required_fields',
        condition: (input: any) => input.messages && Array.isArray(input.messages),
        expectedResult: { validated: true, fields: 'present' }
      }
    ];
  }

  private applyRule(rule: any, input: any): { passed: boolean; result?: any; ruleName: string } {
    return {
      passed: rule.condition(input),
      result: rule.expectedResult,
      ruleName: rule.name
    };
  }

  private generateRuleBasedResult(ruleResults: any[], input: any): any {
    return {
      validated: true,
      passedRules: ruleResults.filter(r => r.passed).length,
      totalRules: ruleResults.length,
      ruleDetails: ruleResults.map(r => ({
        name: r.ruleName,
        passed: r.passed,
        result: r.result
      })),
      originalInput: input
    };
  }

  private synthesizeResults(validationResults: Array<{
    method: string;
    result: any;
    confidence: number;
    weight: number;
  }>): { output: any; primaryMethod: string } {
    if (validationResults.length === 0) {
      throw new GroundTruthGenerationError('No validation results available');
    }

    let maxScore = 0;
    let primaryResult = validationResults[0];

    for (const result of validationResults) {
      const score = result.confidence * result.weight;
      if (score > maxScore) {
        maxScore = score;
        primaryResult = result;
      }
    }

    return {
      output: primaryResult.result,
      primaryMethod: primaryResult.method
    };
  }

  private calculateConfidence(validationResults: Array<{
    method: string;
    result: any;
    confidence: number;
    weight: number;
  }>): ConfidenceScore {
    if (validationResults.length === 0) {
      return {
        overall: 0,
        components: {
          dataQuality: 0,
          referenceReliability: 0,
          validationCoverage: 0,
          historicalConsistency: 0
        },
        factors: ['No validation methods available']
      };
    }

    const totalWeight = validationResults.reduce((sum, r) => sum + r.weight, 0);
    const weightedConfidence = validationResults.reduce((sum, r) => 
      sum + (r.confidence * r.weight), 0) / totalWeight;

    const components = {
      dataQuality: this.calculateDataQuality(validationResults),
      referenceReliability: this.calculateReferenceReliability(validationResults),
      validationCoverage: validationResults.length / 4,
      historicalConsistency: this.calculateHistoricalConsistency(validationResults)
    };

    const overall = (
      weightedConfidence * 0.4 +
      components.dataQuality * 0.25 +
      components.referenceReliability * 0.2 +
      components.validationCoverage * 0.15
    );

    return {
      overall: Math.max(0, Math.min(1, overall)),
      components,
      factors: validationResults.map(r => `${r.method}: ${(r.confidence * 100).toFixed(1)}%`)
    };
  }

  private calculateDataQuality(results: any[]): number {
    return results.length > 0 ? Math.min(1, results.length * 0.25) : 0.0;
  }

  private calculateReferenceReliability(results: any[]): number {
    const hasClaudeRouter = results.some(r => r.method === 'claude_router');
    const hasManual = results.some(r => r.method === 'manual');
    return (hasClaudeRouter ? 0.6 : 0) + (hasManual ? 0.4 : 0);
  }

  private calculateHistoricalConsistency(results: any[]): number {
    return results.some(r => r.method === 'historical') ? 0.7 : 0.3;
  }
}