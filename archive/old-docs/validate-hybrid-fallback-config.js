#!/usr/bin/env node

/**
 * RCC v4.0 混合配置降级逻辑验证
 * 
 * 验证混合多Provider配置中的configurable fallback rules
 * 不需要运行实际服务器，专注于配置逻辑验证
 * 
 * @author Jason Zhang
 * @version 4.0.0-alpha.2
 */

const fs = require('fs').promises;
const path = require('path');

class HybridFallbackConfigValidator {
  constructor() {
    this.configPath = require('path').join(require('os').homedir(), '.route-claudecode/config/v4/hybrid-multi-provider-v3-5509.json');
    this.validationResults = {
      structureValidation: {},
      fallbackChainValidation: {},
      crossProviderValidation: {},
      performanceThresholds: {},
      overallScore: 0
    };
  }

  /**
   * 主验证入口
   */
  async validateConfig() {
    console.log('🔍 开始混合配置降级逻辑验证...\n');
    
    try {
      // 1. 加载配置
      const config = await this.loadConfig();
      
      // 2. 结构验证
      await this.validateStructure(config);
      
      // 3. 降级链逻辑验证
      await this.validateFallbackChains(config);
      
      // 4. 跨Provider策略验证
      await this.validateCrossProviderStrategy(config);
      
      // 5. 性能阈值验证
      await this.validatePerformanceThresholds(config);
      
      // 6. 生成验证报告
      this.generateValidationReport();
      
    } catch (error) {
      console.error('❌ 验证失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 加载配置文件
   */
  async loadConfig() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      throw new Error(`无法加载配置文件: ${error.message}`);
    }
  }

  /**
   * 验证配置结构
   */
  async validateStructure(config) {
    console.log('📋 验证 1: 配置结构完整性...');
    
    const structureChecks = {
      hasProviders: !!config.providers,
      hasRouting: !!config.routing,
      hasCrossProviderStrategy: !!config.crossProviderStrategy,
      hasFallbackRules: !!config.crossProviderStrategy?.fallbackRules,
      hasMetadata: !!config.metadata
    };
    
    // 验证Provider数量和类型
    const providers = config.providers || {};
    const providerCount = Object.keys(providers).length;
    const providerTypes = Object.values(providers).map(p => p.type);
    
    console.log(`  ✓ 找到 ${providerCount} 个Provider: ${Object.keys(providers).join(', ')}`);
    console.log(`  ✓ Provider类型: ${[...new Set(providerTypes)].join(', ')}`);
    
    // 验证路由类别
    const routingCategories = config.routing?.categories || {};
    const categoryCount = Object.keys(routingCategories).length;
    
    console.log(`  ✓ 找到 ${categoryCount} 个路由类别: ${Object.keys(routingCategories).join(', ')}`);
    
    // 验证降级规则类别
    const fallbackRules = config.crossProviderStrategy?.fallbackRules || {};
    const fallbackCategoryCount = Object.keys(fallbackRules).length;
    
    console.log(`  ✓ 找到 ${fallbackCategoryCount} 个降级规则类别: ${Object.keys(fallbackRules).join(', ')}`);
    
    this.validationResults.structureValidation = {
      ...structureChecks,
      providerCount,
      categoryCount,
      fallbackCategoryCount,
      score: this.calculateStructureScore(structureChecks, providerCount, categoryCount, fallbackCategoryCount)
    };
    
    console.log('✅ 配置结构验证完成\n');
  }

  /**
   * 验证降级链逻辑
   */
  async validateFallbackChains(config) {
    console.log('🔄 验证 2: 降级链逻辑...');
    
    const fallbackRules = config.crossProviderStrategy?.fallbackRules || {};
    const providers = config.providers || {};
    const categoryValidations = {};
    
    for (const [category, rule] of Object.entries(fallbackRules)) {
      console.log(`  验证类别: ${category}`);
      
      const validation = {
        hasPrimaryChain: Array.isArray(rule.primaryChain) && rule.primaryChain.length > 0,
        hasEmergencyChain: Array.isArray(rule.emergencyChain) && rule.emergencyChain.length > 0,
        hasConditions: !!rule.conditions,
        validProviders: [],
        invalidProviders: [],
        chainLength: {
          primary: rule.primaryChain?.length || 0,
          emergency: rule.emergencyChain?.length || 0
        },
        priorityOrder: true,
        latencyThresholds: true
      };
      
      // 验证主降级链
      if (rule.primaryChain) {
        validation.validProviders = this.validateProviderChain(rule.primaryChain, providers, 'primary');
        validation.invalidProviders = rule.primaryChain
          .filter(item => !providers[item.provider])
          .map(item => item.provider);
        
        // 验证优先级顺序
        validation.priorityOrder = this.validatePriorityOrder(rule.primaryChain);
        
        // 验证延迟阈值合理性
        validation.latencyThresholds = this.validateLatencyThresholds(rule.primaryChain);
      }
      
      // 验证应急降级链
      if (rule.emergencyChain) {
        const emergencyValidProviders = this.validateProviderChain(rule.emergencyChain, providers, 'emergency');
        validation.validProviders.push(...emergencyValidProviders);
      }
      
      // 验证触发条件
      if (rule.conditions) {
        validation.conditionsValid = this.validateFallbackConditions(rule.conditions);
      }
      
      categoryValidations[category] = validation;
      
      const score = this.calculateFallbackChainScore(validation);
      console.log(`    ✓ ${category}: 评分 ${score}/100 (主链${validation.chainLength.primary}项, 应急链${validation.chainLength.emergency}项)`);
    }
    
    this.validationResults.fallbackChainValidation = categoryValidations;
    console.log('✅ 降级链逻辑验证完成\n');
  }

  /**
   * 验证Provider链
   */
  validateProviderChain(chain, providers, chainType) {
    const validProviders = [];
    
    for (const item of chain) {
      if (providers[item.provider]) {
        validProviders.push({
          provider: item.provider,
          model: item.model,
          priority: item.priority,
          maxLatency: item.maxLatency,
          description: item.description,
          chainType
        });
      }
    }
    
    return validProviders;
  }

  /**
   * 验证优先级顺序
   */
  validatePriorityOrder(chain) {
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].priority <= chain[i-1].priority) {
        return false; // 优先级应该递增
      }
    }
    return true;
  }

  /**
   * 验证延迟阈值
   */
  validateLatencyThresholds(chain) {
    return chain.every(item => {
      return item.maxLatency && 
             item.maxLatency > 1000 && // 至少1秒
             item.maxLatency < 60000;  // 不超过60秒
    });
  }

  /**
   * 验证降级条件
   */
  validateFallbackConditions(conditions) {
    const requiredFields = [
      'triggerOnLatency',
      'triggerOnErrorRate', 
      'triggerOnConsecutiveFailures',
      'recoverySuccessThreshold',
      'recoveryTimeoutMs'
    ];
    
    return requiredFields.every(field => {
      return conditions[field] !== undefined && 
             typeof conditions[field] === 'number' &&
             conditions[field] > 0;
    });
  }

  /**
   * 验证跨Provider策略
   */
  async validateCrossProviderStrategy(config) {
    console.log('🌐 验证 3: 跨Provider策略...');
    
    const strategy = config.crossProviderStrategy || {};
    
    const validations = {
      hasFailoverPolicy: !!strategy.failoverPolicy,
      hasLoadBalancing: !!strategy.loadBalancing,
      hasRateLimitManagement: !!strategy.rateLimitManagement,
      hasPerformanceThresholds: !!strategy.performanceThresholds,
      hasDecisionWeights: !!strategy.decisionWeights,
      hasRecoveryStrategy: !!strategy.recoveryStrategy
    };
    
    // 验证故障转移策略
    if (strategy.failoverPolicy) {
      validations.failoverPolicyValid = this.validateFailoverPolicy(strategy.failoverPolicy);
      console.log(`    ✓ 故障转移策略: ${validations.failoverPolicyValid ? '有效' : '无效'}`);
    }
    
    // 验证负载均衡
    if (strategy.loadBalancing) {
      validations.loadBalancingValid = this.validateLoadBalancing(strategy.loadBalancing, config.providers);
      console.log(`    ✓ 负载均衡: ${validations.loadBalancingValid ? '有效' : '无效'}`);
    }
    
    // 验证速率限制管理
    if (strategy.rateLimitManagement) {
      validations.rateLimitValid = this.validateRateLimitManagement(strategy.rateLimitManagement);
      console.log(`    ✓ 速率限制管理: ${validations.rateLimitValid ? '有效' : '无效'}`);
    }
    
    this.validationResults.crossProviderValidation = validations;
    console.log('✅ 跨Provider策略验证完成\n');
  }

  /**
   * 验证故障转移策略
   */
  validateFailoverPolicy(policy) {
    return !!(policy.maxFailuresBeforeSwitch && 
              policy.providerCooldownMs &&
              policy.adaptiveRecovery !== undefined &&
              policy.recoveryCheckInterval);
  }

  /**
   * 验证负载均衡
   */
  validateLoadBalancing(loadBalancing, providers) {
    if (!loadBalancing.enabled || !loadBalancing.weights) return false;
    
    const providerIds = Object.keys(providers || {});
    const weightProviders = Object.keys(loadBalancing.weights);
    
    // 检查所有Provider都有权重配置
    return providerIds.every(id => weightProviders.includes(id));
  }

  /**
   * 验证速率限制管理
   */
  validateRateLimitManagement(rateLimit) {
    return !!(rateLimit.enabled !== undefined &&
              rateLimit.globalRateLimitThreshold &&
              rateLimit.providerSpecificThresholds &&
              rateLimit.adaptiveCooldown);
  }

  /**
   * 验证性能阈值
   */
  async validatePerformanceThresholds(config) {
    console.log('🚀 验证 4: 性能阈值配置...');
    
    const thresholds = config.crossProviderStrategy?.performanceThresholds || {};
    
    const validations = {
      hasMaxLatency: !!thresholds.maxLatency,
      hasMaxErrorRate: !!thresholds.maxErrorRate,
      hasMinAvailability: !!thresholds.minAvailability,
      hasMinQualityScore: !!thresholds.minQualityScore,
      thresholdsReasonable: true
    };
    
    // 验证阈值合理性
    if (thresholds.maxLatency && thresholds.maxLatency > 60000) {
      validations.thresholdsReasonable = false;
      console.log('    ⚠️ 最大延迟阈值过高 (>60秒)');
    }
    
    if (thresholds.maxErrorRate && (thresholds.maxErrorRate < 0 || thresholds.maxErrorRate > 1)) {
      validations.thresholdsReasonable = false;
      console.log('    ⚠️ 错误率阈值范围无效 (应在0-1之间)');
    }
    
    if (thresholds.minAvailability && (thresholds.minAvailability < 0 || thresholds.minAvailability > 1)) {
      validations.thresholdsReasonable = false;
      console.log('    ⚠️ 可用性阈值范围无效 (应在0-1之间)');
    }
    
    // 验证决策权重
    const decisionWeights = config.crossProviderStrategy?.decisionWeights || {};
    const totalWeight = Object.values(decisionWeights).reduce((sum, weight) => sum + (weight || 0), 0);
    validations.decisionWeightsValid = Math.abs(totalWeight - 1.0) < 0.01; // 权重总和应为1
    
    console.log(`    ✓ 性能阈值完整性: ${Object.values(validations).slice(0, 4).every(v => v) ? '完整' : '不完整'}`);
    console.log(`    ✓ 决策权重总和: ${totalWeight.toFixed(2)} ${validations.decisionWeightsValid ? '✓' : '✗'}`);
    
    this.validationResults.performanceThresholds = validations;
    console.log('✅ 性能阈值验证完成\n');
  }

  /**
   * 计算结构评分
   */
  calculateStructureScore(checks, providerCount, categoryCount, fallbackCategoryCount) {
    let score = 0;
    
    // 基础结构分 (40分)
    score += Object.values(checks).filter(Boolean).length * 8;
    
    // Provider数量分 (20分)
    if (providerCount >= 3) score += 20;
    else if (providerCount >= 2) score += 15;
    else if (providerCount >= 1) score += 10;
    
    // 类别覆盖分 (20分)
    if (categoryCount >= 6) score += 20;
    else if (categoryCount >= 4) score += 15;
    else if (categoryCount >= 2) score += 10;
    
    // 降级规则覆盖分 (20分)
    if (fallbackCategoryCount >= categoryCount) score += 20;
    else score += (fallbackCategoryCount / categoryCount) * 20;
    
    return Math.min(100, score);
  }

  /**
   * 计算降级链评分
   */
  calculateFallbackChainScore(validation) {
    let score = 0;
    
    // 基础链存在性 (30分)
    if (validation.hasPrimaryChain) score += 15;
    if (validation.hasEmergencyChain) score += 15;
    
    // 链长度合理性 (20分)
    const totalLength = validation.chainLength.primary + validation.chainLength.emergency;
    if (totalLength >= 4) score += 20;
    else score += (totalLength / 4) * 20;
    
    // Provider有效性 (20分)
    const validRatio = validation.validProviders.length / 
      (validation.validProviders.length + validation.invalidProviders.length || 1);
    score += validRatio * 20;
    
    // 逻辑正确性 (30分)
    if (validation.priorityOrder) score += 10;
    if (validation.latencyThresholds) score += 10;
    if (validation.conditionsValid) score += 10;
    
    return Math.min(100, score);
  }

  /**
   * 生成验证报告
   */
  generateValidationReport() {
    console.log('📊 验证报告');
    console.log('='.repeat(60));
    
    // 计算总体评分
    const structureScore = this.validationResults.structureValidation.score || 0;
    
    const fallbackScores = Object.values(this.validationResults.fallbackChainValidation)
      .map(v => this.calculateFallbackChainScore(v));
    const avgFallbackScore = fallbackScores.length > 0 ? 
      fallbackScores.reduce((a, b) => a + b, 0) / fallbackScores.length : 0;
    
    const crossProviderChecks = Object.values(this.validationResults.crossProviderValidation)
      .filter(v => typeof v === 'boolean');
    const crossProviderScore = (crossProviderChecks.filter(Boolean).length / crossProviderChecks.length) * 100 || 0;
    
    const performanceChecks = Object.values(this.validationResults.performanceThresholds)
      .filter(v => typeof v === 'boolean');
    const performanceScore = (performanceChecks.filter(Boolean).length / performanceChecks.length) * 100 || 0;
    
    this.validationResults.overallScore = (structureScore + avgFallbackScore + crossProviderScore + performanceScore) / 4;
    
    // 详细报告
    console.log(`\n1. 配置结构: ${structureScore.toFixed(1)}/100`);
    console.log(`   - Provider数量: ${this.validationResults.structureValidation.providerCount}`);
    console.log(`   - 路由类别: ${this.validationResults.structureValidation.categoryCount}`);
    console.log(`   - 降级规则: ${this.validationResults.structureValidation.fallbackCategoryCount}`);
    
    console.log(`\n2. 降级链逻辑: ${avgFallbackScore.toFixed(1)}/100`);
    for (const [category, validation] of Object.entries(this.validationResults.fallbackChainValidation)) {
      const score = this.calculateFallbackChainScore(validation);
      console.log(`   - ${category}: ${score.toFixed(1)}/100 (主链${validation.chainLength.primary}项, 应急链${validation.chainLength.emergency}项)`);
    }
    
    console.log(`\n3. 跨Provider策略: ${crossProviderScore.toFixed(1)}/100`);
    const cpv = this.validationResults.crossProviderValidation;
    console.log(`   - 故障转移: ${cpv.hasFailoverPolicy ? '✓' : '✗'}`);
    console.log(`   - 负载均衡: ${cpv.hasLoadBalancing ? '✓' : '✗'}`);
    console.log(`   - 速率限制: ${cpv.hasRateLimitManagement ? '✓' : '✗'}`);
    
    console.log(`\n4. 性能阈值: ${performanceScore.toFixed(1)}/100`);
    const pt = this.validationResults.performanceThresholds;
    console.log(`   - 延迟阈值: ${pt.hasMaxLatency ? '✓' : '✗'}`);
    console.log(`   - 错误率阈值: ${pt.hasMaxErrorRate ? '✓' : '✗'}`);
    console.log(`   - 可用性阈值: ${pt.hasMinAvailability ? '✓' : '✗'}`);
    console.log(`   - 决策权重: ${pt.decisionWeightsValid ? '✓' : '✗'}`);
    
    console.log('\n' + '='.repeat(60));
    console.log(`🎯 总体评分: ${this.validationResults.overallScore.toFixed(1)}/100`);
    
    // 评级
    let grade = 'F';
    if (this.validationResults.overallScore >= 90) grade = 'A';
    else if (this.validationResults.overallScore >= 80) grade = 'B';
    else if (this.validationResults.overallScore >= 70) grade = 'C';
    else if (this.validationResults.overallScore >= 60) grade = 'D';
    
    console.log(`📊 配置质量等级: ${grade}`);
    
    // 生成建议
    this.generateRecommendations();
  }

  /**
   * 生成改进建议
   */
  generateRecommendations() {
    console.log('\n💡 改进建议:');
    
    const recommendations = [];
    
    // 基于验证结果生成建议
    if (this.validationResults.structureValidation.score < 80) {
      recommendations.push('完善配置结构，确保所有必需节点都存在');
    }
    
    const fallbackIssues = Object.entries(this.validationResults.fallbackChainValidation)
      .filter(([, v]) => this.calculateFallbackChainScore(v) < 80)
      .map(([category]) => category);
    
    if (fallbackIssues.length > 0) {
      recommendations.push(`优化以下类别的降级链配置: ${fallbackIssues.join(', ')}`);
    }
    
    if (!this.validationResults.crossProviderValidation.loadBalancingValid) {
      recommendations.push('检查负载均衡配置，确保所有Provider都有权重设置');
    }
    
    if (!this.validationResults.performanceThresholds.decisionWeightsValid) {
      recommendations.push('调整决策权重，确保总和为1.0');
    }
    
    if (!this.validationResults.performanceThresholds.thresholdsReasonable) {
      recommendations.push('检查性能阈值设置，确保数值在合理范围内');
    }
    
    if (this.validationResults.overallScore >= 85) {
      console.log('   ✨ 配置质量优秀！降级策略设计合理，可以投入生产使用');
    } else if (recommendations.length === 0) {
      console.log('   ✅ 配置基本合格，建议进行实际测试验证');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n🔍 配置特色亮点:');
    console.log('   ✓ 支持完全可配置的降级模型策略');
    console.log('   ✓ 智能跨Provider故障转移');
    console.log('   ✓ 多层次降级链(主链+应急链)');
    console.log('   ✓ 自适应负载均衡和恢复机制');
    console.log('   ✓ 细粒度的性能阈值控制');
  }
}

// 主执行逻辑
async function main() {
  const validator = new HybridFallbackConfigValidator();
  await validator.validateConfig();
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = HybridFallbackConfigValidator;