/**
 * Gemini多实例管理器
 * 负责管理多个Gemini API密钥和实例的负载均衡、故障切换
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';
import { GeminiClientFactory } from '../provider-protocol/gemini/client-factory.js';

const logger = getLogger();

export class GeminiMultiInstanceManager {
    constructor(config) {
        this.config = config;
        this.instances = new Map();
        this.keyRotationIndex = 0;
        this.keyStats = new Map();
        this.keyFailureCount = new Map();
        this.lastUsed = new Map();
        
        logger.debug('Gemini multi-instance manager initialized', {
            apiKeyCount: config.authentication?.credentials?.apiKeys?.length || 0,
            maxInstancesPerProvider: config.multiInstance?.maxInstancesPerProvider || 3,
            keyRotationStrategy: config.multiInstance?.keyRotation?.strategy || 'round_robin'
        });

        this.initializeInstances();
    }

    /**
     * 初始化所有API密钥实例
     */
    initializeInstances() {
        const apiKeys = this.config.authentication?.credentials?.apiKeys || [];
        
        if (apiKeys.length === 0) {
            throw new Error('No Gemini API keys provided for multi-instance management');
        }

        apiKeys.forEach((apiKey, index) => {
            const instanceId = `gemini-instance-${index}`;
            
            try {
                // 为每个API密钥创建独立的配置
                const instanceConfig = {
                    ...this.config,
                    apiKey: apiKey,
                    instanceId: instanceId,
                    instanceIndex: index
                };

                // 创建Gemini客户端实例
                const client = GeminiClientFactory.createValidatedClient(instanceConfig);
                
                this.instances.set(instanceId, {
                    client,
                    apiKey: apiKey.substring(0, 8) + '***', // 脱敏显示
                    instanceId,
                    index,
                    healthy: true,
                    lastHealthCheck: null,
                    consecutiveFailures: 0,
                    rateLimitUntil: null
                });

                // 初始化统计数据
                this.keyStats.set(instanceId, {
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0,
                    rateLimitHits: 0,
                    lastUsed: null,
                    averageResponseTime: 0
                });

                this.keyFailureCount.set(instanceId, 0);
                this.lastUsed.set(instanceId, 0);

                logger.debug(`Gemini instance ${instanceId} initialized`, {
                    apiKey: this.instances.get(instanceId).apiKey,
                    index
                });

            } catch (error) {
                logger.error(`Failed to initialize Gemini instance ${instanceId}`, {
                    error: error.message,
                    index
                });
            }
        });

        logger.info('Gemini multi-instance initialization completed', {
            totalInstances: this.instances.size,
            healthyInstances: Array.from(this.instances.values()).filter(i => i.healthy).length
        });
    }

    /**
     * 获取可用的实例（支持负载均衡策略）
     */
    getAvailableInstance() {
        const strategy = this.config.multiInstance?.keyRotation?.strategy || 'round_robin';
        const now = Date.now();

        // 过滤可用实例
        const availableInstances = Array.from(this.instances.entries())
            .filter(([instanceId, instance]) => {
                // 检查健康状态
                if (!instance.healthy) {
                    return false;
                }

                // 检查速率限制冷却时间
                if (instance.rateLimitUntil && instance.rateLimitUntil > now) {
                    return false;
                }

                // 检查连续失败次数
                const maxFailures = this.config.multiInstance?.keyRotation?.maxRetriesPerKey || 2;
                if (instance.consecutiveFailures >= maxFailures) {
                    return false;
                }

                return true;
            });

        if (availableInstances.length === 0) {
            throw new Error('No available Gemini instances for request processing');
        }

        let selectedInstance;

        switch (strategy) {
            case 'round_robin':
                selectedInstance = this.selectRoundRobinInstance(availableInstances);
                break;
                
            case 'least_used':
                selectedInstance = this.selectLeastUsedInstance(availableInstances);
                break;
                
            case 'health_based':
                selectedInstance = this.selectHealthBasedInstance(availableInstances);
                break;
                
            default:
                selectedInstance = this.selectRoundRobinInstance(availableInstances);
                break;
        }

        // 更新使用时间
        this.lastUsed.set(selectedInstance[0], now);
        
        logger.debug('Selected Gemini instance', {
            instanceId: selectedInstance[0],
            strategy,
            availableInstances: availableInstances.length,
            totalInstances: this.instances.size
        });

        return selectedInstance[1];
    }

    /**
     * 轮询选择策略
     */
    selectRoundRobinInstance(availableInstances) {
        const index = this.keyRotationIndex % availableInstances.length;
        this.keyRotationIndex++;
        return availableInstances[index];
    }

    /**
     * 最少使用策略
     */
    selectLeastUsedInstance(availableInstances) {
        return availableInstances.reduce((least, current) => {
            const leastStats = this.keyStats.get(least[0]);
            const currentStats = this.keyStats.get(current[0]);
            
            return (currentStats.totalRequests < leastStats.totalRequests) ? current : least;
        });
    }

    /**
     * 基于健康度选择策略
     */
    selectHealthBasedInstance(availableInstances) {
        return availableInstances.reduce((best, current) => {
            const bestStats = this.keyStats.get(best[0]);
            const currentStats = this.keyStats.get(current[0]);
            
            const bestSuccessRate = bestStats.totalRequests > 0 ? 
                bestStats.successfulRequests / bestStats.totalRequests : 1;
            const currentSuccessRate = currentStats.totalRequests > 0 ? 
                currentStats.successfulRequests / currentStats.totalRequests : 1;
            
            return (currentSuccessRate > bestSuccessRate) ? current : best;
        });
    }

    /**
     * 处理请求成功
     */
    recordSuccess(instanceId, responseTime) {
        const instance = this.instances.get(instanceId);
        const stats = this.keyStats.get(instanceId);
        
        if (instance && stats) {
            // 重置失败计数
            instance.consecutiveFailures = 0;
            instance.healthy = true;
            
            // 更新统计
            stats.totalRequests++;
            stats.successfulRequests++;
            stats.lastUsed = Date.now();
            
            // 更新平均响应时间
            if (responseTime) {
                const currentAvg = stats.averageResponseTime;
                const totalSuccessful = stats.successfulRequests;
                stats.averageResponseTime = (currentAvg * (totalSuccessful - 1) + responseTime) / totalSuccessful;
            }

            logger.debug('Recorded successful request for Gemini instance', {
                instanceId,
                consecutiveFailures: instance.consecutiveFailures,
                totalRequests: stats.totalRequests,
                successRate: (stats.successfulRequests / stats.totalRequests * 100).toFixed(2) + '%'
            });
        }
    }

    /**
     * 处理请求失败
     */
    recordFailure(instanceId, error) {
        const instance = this.instances.get(instanceId);
        const stats = this.keyStats.get(instanceId);
        
        if (instance && stats) {
            // 增加失败计数
            instance.consecutiveFailures++;
            stats.totalRequests++;
            stats.failedRequests++;

            // 检查是否是速率限制错误
            if (error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
                stats.rateLimitHits++;
                const cooldownMs = this.config.multiInstance?.keyRotation?.rateLimitCooldownMs || 60000;
                instance.rateLimitUntil = Date.now() + cooldownMs;
                
                logger.warn('Gemini instance hit rate limit', {
                    instanceId,
                    cooldownUntil: new Date(instance.rateLimitUntil).toISOString(),
                    rateLimitHits: stats.rateLimitHits
                });
            }

            // 检查是否需要标记为不健康
            const maxFailures = this.config.multiInstance?.keyRotation?.maxRetriesPerKey || 2;
            if (instance.consecutiveFailures >= maxFailures) {
                instance.healthy = false;
                
                logger.error('Gemini instance marked as unhealthy', {
                    instanceId,
                    consecutiveFailures: instance.consecutiveFailures,
                    maxFailures
                });
            }

            logger.debug('Recorded failed request for Gemini instance', {
                instanceId,
                consecutiveFailures: instance.consecutiveFailures,
                error: error.message,
                healthy: instance.healthy
            });
        }
    }

    /**
     * 执行健康检查
     */
    async performHealthChecks() {
        const healthCheckPromises = Array.from(this.instances.entries()).map(async ([instanceId, instance]) => {
            try {
                const startTime = Date.now();
                const health = await instance.client.healthCheck();
                const responseTime = Date.now() - startTime;

                if (health.healthy) {
                    // 重置失败计数，标记为健康
                    instance.consecutiveFailures = 0;
                    instance.healthy = true;
                    instance.lastHealthCheck = Date.now();
                    
                    logger.debug('Gemini instance health check passed', {
                        instanceId,
                        responseTime
                    });
                } else {
                    instance.healthy = false;
                    logger.warn('Gemini instance health check failed', {
                        instanceId,
                        error: health.error
                    });
                }

            } catch (error) {
                instance.healthy = false;
                instance.consecutiveFailures++;
                
                logger.error('Gemini instance health check error', {
                    instanceId,
                    error: error.message
                });
            }
        });

        await Promise.allSettled(healthCheckPromises);
        
        const healthyCount = Array.from(this.instances.values()).filter(i => i.healthy).length;
        
        logger.info('Gemini multi-instance health check completed', {
            totalInstances: this.instances.size,
            healthyInstances: healthyCount,
            unhealthyInstances: this.instances.size - healthyCount
        });

        return {
            total: this.instances.size,
            healthy: healthyCount,
            unhealthy: this.instances.size - healthyCount
        };
    }

    /**
     * 获取实例统计信息
     */
    getStats() {
        const instanceStats = Array.from(this.instances.entries()).map(([instanceId, instance]) => {
            const stats = this.keyStats.get(instanceId);
            return {
                instanceId,
                apiKey: instance.apiKey,
                healthy: instance.healthy,
                consecutiveFailures: instance.consecutiveFailures,
                rateLimitUntil: instance.rateLimitUntil,
                lastHealthCheck: instance.lastHealthCheck,
                stats: {
                    totalRequests: stats.totalRequests,
                    successfulRequests: stats.successfulRequests,
                    failedRequests: stats.failedRequests,
                    rateLimitHits: stats.rateLimitHits,
                    successRate: stats.totalRequests > 0 ? 
                        (stats.successfulRequests / stats.totalRequests * 100).toFixed(2) + '%' : '0%',
                    averageResponseTime: stats.averageResponseTime
                }
            };
        });

        return {
            totalInstances: this.instances.size,
            healthyInstances: Array.from(this.instances.values()).filter(i => i.healthy).length,
            keyRotationStrategy: this.config.multiInstance?.keyRotation?.strategy || 'round_robin',
            instances: instanceStats
        };
    }

    /**
     * 重置实例状态（用于故障恢复）
     */
    resetInstanceHealth() {
        Array.from(this.instances.values()).forEach(instance => {
            instance.healthy = true;
            instance.consecutiveFailures = 0;
            instance.rateLimitUntil = null;
        });

        logger.info('All Gemini instances reset to healthy state');
    }
}