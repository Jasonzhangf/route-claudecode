/**
 * CodeWhisperer Multi-Instance Manager - V3.0 Six-Layer Architecture
 * 管理多个CodeWhisperer账号/实例，实现负载均衡和故障切换
 * 基于demo3的多账号管理实现
 * 
 * Project owner: Jason Zhang
 */

export class CodewhispererMultiInstanceManager {
    constructor(instances, strategy = 'round-robin') {
        this.instances = new Map();
        this.strategy = strategy;
        this.currentIndex = 0;
        this.healthStats = new Map();
        this.usageStats = new Map();
        this.lastHealthCheck = 0;
        this.healthCheckInterval = 30000; // 30秒健康检查间隔
        
        // 初始化实例
        this.initializeInstances(instances);
        
        console.log(`[V3:${process.env.RCC_PORT}] Initialized CodeWhisperer multi-instance manager`, {
            totalInstances: this.instances.size,
            strategy: this.strategy,
            instanceIds: Array.from(this.instances.keys())
        });
    }

    /**
     * 初始化所有实例
     */
    initializeInstances(instances) {
        if (!instances || typeof instances !== 'object') {
            throw new Error('CodeWhisperer instances configuration is required');
        }

        for (const [id, config] of Object.entries(instances)) {
            try {
                this.instances.set(id, {
                    id: id,
                    config: config,
                    client: null, // 将在需要时延迟初始化
                    healthy: true,
                    lastUsed: 0,
                    totalRequests: 0,
                    failedRequests: 0,
                    averageResponseTime: 0,
                    credentials: {
                        accessToken: config.authentication?.accessToken,
                        refreshToken: config.authentication?.refreshToken,
                        region: config.authentication?.region || 'us-east-1',
                        profileArn: config.authentication?.profileArn,
                        credPath: config.authentication?.credPath,
                        credsBase64: config.authentication?.credsBase64
                    }
                });

                // 初始化健康状态
                this.healthStats.set(id, {
                    healthy: true,
                    lastCheck: 0,
                    consecutiveFailures: 0,
                    lastError: null
                });

                // 初始化使用统计
                this.usageStats.set(id, {
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0,
                    totalResponseTime: 0,
                    averageResponseTime: 0,
                    lastUsed: 0
                });

                console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:MultiInstance] Registered instance: ${id}`, {
                    region: config.authentication?.region || 'us-east-1',
                    hasCredentials: !!(config.authentication?.accessToken || config.authentication?.credsBase64)
                });
            } catch (error) {
                console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:MultiInstance] Failed to initialize instance ${id}:`, error.message);
            }
        }

        if (this.instances.size === 0) {
            throw new Error('No valid CodeWhisperer instances were initialized');
        }
    }

    /**
     * 根据策略选择实例
     */
    async selectInstance() {
        const healthyInstances = await this.getHealthyInstances();
        
        if (healthyInstances.length === 0) {
            throw new Error('No healthy CodeWhisperer instances available');
        }

        let selectedInstance;

        switch (this.strategy) {
            case 'round-robin':
                selectedInstance = this.selectRoundRobin(healthyInstances);
                break;
            case 'least-used':
                selectedInstance = this.selectLeastUsed(healthyInstances);
                break;
            case 'health-based':
                selectedInstance = this.selectHealthBased(healthyInstances);
                break;
            case 'random':
                selectedInstance = this.selectRandom(healthyInstances);
                break;
            default:
                selectedInstance = this.selectRoundRobin(healthyInstances);
        }

        // 更新使用统计
        const instance = this.instances.get(selectedInstance.id);
        instance.lastUsed = Date.now();
        instance.totalRequests++;

        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:MultiInstance] Selected instance: ${selectedInstance.id} (strategy: ${this.strategy})`);
        return selectedInstance;
    }

    /**
     * Round Robin选择策略
     */
    selectRoundRobin(healthyInstances) {
        const instance = healthyInstances[this.currentIndex % healthyInstances.length];
        this.currentIndex = (this.currentIndex + 1) % healthyInstances.length;
        return instance;
    }

    /**
     * 最少使用选择策略
     */
    selectLeastUsed(healthyInstances) {
        return healthyInstances.reduce((least, current) => {
            const leastStats = this.usageStats.get(least.id);
            const currentStats = this.usageStats.get(current.id);
            
            return currentStats.totalRequests < leastStats.totalRequests ? current : least;
        });
    }

    /**
     * 基于健康度选择策略
     */
    selectHealthBased(healthyInstances) {
        return healthyInstances.reduce((best, current) => {
            const bestStats = this.usageStats.get(best.id);
            const currentStats = this.usageStats.get(current.id);
            const bestHealth = this.healthStats.get(best.id);
            const currentHealth = this.healthStats.get(current.id);
            
            // 优先选择错误率低、响应时间短的实例
            const bestScore = (bestStats.failedRequests / Math.max(bestStats.totalRequests, 1)) + 
                             (bestStats.averageResponseTime / 1000) + 
                             (bestHealth.consecutiveFailures * 0.1);
            const currentScore = (currentStats.failedRequests / Math.max(currentStats.totalRequests, 1)) + 
                                (currentStats.averageResponseTime / 1000) + 
                                (currentHealth.consecutiveFailures * 0.1);
            
            return currentScore < bestScore ? current : best;
        });
    }

    /**
     * 随机选择策略
     */
    selectRandom(healthyInstances) {
        const randomIndex = Math.floor(Math.random() * healthyInstances.length);
        return healthyInstances[randomIndex];
    }

    /**
     * 获取健康的实例列表
     */
    async getHealthyInstances() {
        const now = Date.now();
        const healthyInstances = [];

        // 如果距离上次健康检查超过间隔时间，执行健康检查
        if (now - this.lastHealthCheck > this.healthCheckInterval) {
            await this.performHealthCheck();
            this.lastHealthCheck = now;
        }

        for (const [id, instance] of this.instances) {
            const health = this.healthStats.get(id);
            if (health.healthy) {
                healthyInstances.push(instance);
            }
        }

        return healthyInstances;
    }

    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:MultiInstance] Performing health check on ${this.instances.size} instances`);

        const healthCheckPromises = Array.from(this.instances.entries()).map(async ([id, instance]) => {
            try {
                // 如果客户端未初始化，先初始化
                if (!instance.client) {
                    const { CodewhispererClientFactory } = await import('../provider-protocol/codewhisperer/client-factory.js');
                    instance.client = CodewhispererClientFactory.createValidatedClient(instance.config, id);
                }

                const startTime = Date.now();
                const health = await instance.client.healthCheck();
                const responseTime = Date.now() - startTime;

                const healthStat = this.healthStats.get(id);
                if (health.healthy) {
                    healthStat.healthy = true;
                    healthStat.consecutiveFailures = 0;
                    healthStat.lastError = null;
                } else {
                    healthStat.healthy = false;
                    healthStat.consecutiveFailures++;
                    healthStat.lastError = health.error || 'Health check failed';
                }
                healthStat.lastCheck = Date.now();

                // 更新响应时间统计
                const usageStat = this.usageStats.get(id);
                if (usageStat.totalRequests > 0) {
                    usageStat.averageResponseTime = (usageStat.totalResponseTime + responseTime) / (usageStat.totalRequests + 1);
                } else {
                    usageStat.averageResponseTime = responseTime;
                }

                console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:MultiInstance] Health check ${id}: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'} (${responseTime}ms)`);
            } catch (error) {
                const healthStat = this.healthStats.get(id);
                healthStat.healthy = false;
                healthStat.consecutiveFailures++;
                healthStat.lastError = error.message;
                healthStat.lastCheck = Date.now();

                console.warn(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:MultiInstance] Health check failed for ${id}: ${error.message}`);
            }
        });

        await Promise.allSettled(healthCheckPromises);
    }

    /**
     * 记录请求结果
     */
    recordRequestResult(instanceId, success, responseTime, error = null) {
        const instance = this.instances.get(instanceId);
        const usageStat = this.usageStats.get(instanceId);
        const healthStat = this.healthStats.get(instanceId);

        if (instance && usageStat) {
            if (success) {
                usageStat.successfulRequests++;
                healthStat.consecutiveFailures = 0;
                healthStat.lastError = null;
            } else {
                usageStat.failedRequests++;
                instance.failedRequests++;
                healthStat.consecutiveFailures++;
                healthStat.lastError = error;

                // 如果连续失败超过3次，标记为不健康
                if (healthStat.consecutiveFailures >= 3) {
                    healthStat.healthy = false;
                }
            }

            // 更新平均响应时间
            usageStat.totalResponseTime += responseTime;
            usageStat.averageResponseTime = usageStat.totalResponseTime / usageStat.totalRequests;
            instance.averageResponseTime = usageStat.averageResponseTime;
        }
    }

    /**
     * 获取实例状态
     */
    getInstanceStatus() {
        const status = {
            strategy: this.strategy,
            totalInstances: this.instances.size,
            healthyInstances: 0,
            instances: {}
        };

        for (const [id, instance] of this.instances) {
            const health = this.healthStats.get(id);
            const usage = this.usageStats.get(id);

            if (health.healthy) {
                status.healthyInstances++;
            }

            status.instances[id] = {
                id: instance.id,
                healthy: health.healthy,
                region: instance.credentials.region,
                totalRequests: usage.totalRequests,
                successfulRequests: usage.successfulRequests,
                failedRequests: usage.failedRequests,
                averageResponseTime: Math.round(usage.averageResponseTime),
                lastUsed: usage.lastUsed,
                consecutiveFailures: health.consecutiveFailures,
                lastHealthCheck: health.lastCheck,
                lastError: health.lastError
            };
        }

        return status;
    }

    /**
     * 获取实例by ID
     */
    getInstance(id) {
        return this.instances.get(id);
    }

    /**
     * 获取所有实例ID
     */
    getInstanceIds() {
        return Array.from(this.instances.keys());
    }

    /**
     * 设置选择策略
     */
    setStrategy(strategy) {
        const validStrategies = ['round-robin', 'least-used', 'health-based', 'random'];
        if (validStrategies.includes(strategy)) {
            this.strategy = strategy;
            console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:MultiInstance] Strategy changed to: ${strategy}`);
        } else {
            throw new Error(`Invalid strategy: ${strategy}. Valid strategies: ${validStrategies.join(', ')}`);
        }
    }

    /**
     * 重置统计信息
     */
    resetStats() {
        for (const [id, instance] of this.instances) {
            instance.totalRequests = 0;
            instance.failedRequests = 0;
            instance.averageResponseTime = 0;

            this.usageStats.set(id, {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                totalResponseTime: 0,
                averageResponseTime: 0,
                lastUsed: 0
            });

            this.healthStats.set(id, {
                healthy: true,
                lastCheck: 0,
                consecutiveFailures: 0,
                lastError: null
            });
        }

        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:MultiInstance] Statistics reset for all instances`);
    }
}