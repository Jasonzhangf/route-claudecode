#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - LMStudio/Ollama SDK Integration Manager
 * 
 * Official SDK priority integration system providing:
 * - Dynamic SDK detection and availability checking
 * - LMStudio official SDK integration with OpenAI-compatible fallback
 * - Ollama official SDK integration with standalone implementation fallback
 * - Runtime strategy selection based on SDK availability
 * - Compatibility preprocessing for fallback modes
 * - Performance optimization for local model serving
 * - Configuration support for local model servers
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

import { createErrorHandler } from '../../shared/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

export class LMStudioOllamaSDKManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Detection settings
            sdkDetectionTimeout: config.sdkDetectionTimeout || 5000,
            fallbackMode: config.fallbackMode !== false, // Enable fallback by default
            performanceOptimization: config.performanceOptimization !== false,
            
            // Local model server settings
            lmStudioDefaultPort: config.lmStudioDefaultPort || 1234,
            ollamaDefaultPort: config.ollamaDefaultPort || 11434,
            
            // SDK preferences
            preferOfficialSDK: config.preferOfficialSDK !== false,
            sdkCacheTimeout: config.sdkCacheTimeout || 300000, // 5 minutes
            
            ...config
        };

        this.errorHandler = createErrorHandler('LMStudioOllamaSDKManager');
        this.sdkCache = new Map();
        this.capabilityCache = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🔍 Initializing LMStudio/Ollama SDK Manager...');
            
            // Detect available SDKs
            await this.detectAvailableSDKs();
            
            // Initialize SDK configurations
            await this.initializeSDKConfigurations();
            
            this.initialized = true;
            console.log('✅ LMStudio/Ollama SDK Manager initialized');
            
            this.emit('initialized', {
                lmStudioSDK: this.sdkCache.get('lmstudio'),
                ollamaSDK: this.sdkCache.get('ollama')
            });
            
            return {
                status: 'initialized',
                availableSDKs: Array.from(this.sdkCache.keys()),
                capabilities: Object.fromEntries(this.capabilityCache)
            };
        } catch (error) {
            this.errorHandler.handleCriticalError(error, 'sdk-manager-initialization', {
                config: this.config
            });
        }
    }

    async detectAvailableSDKs() {
        console.log('🔍 Detecting available SDKs...');
        
        const detectionResults = {
            lmstudio: await this.detectLMStudioSDK(),
            ollama: await this.detectOllamaSDK()
        };

        for (const [sdkName, result] of Object.entries(detectionResults)) {
            if (result.available) {
                this.sdkCache.set(sdkName, {
                    available: true,
                    version: result.version,
                    path: result.path,
                    capabilities: result.capabilities,
                    detectedAt: new Date().toISOString()
                });
                console.log(`✅ ${sdkName.toUpperCase()}: ${result.version} detected at ${result.path}`);
            } else {
                this.sdkCache.set(sdkName, {
                    available: false,
                    fallbackMode: this.config.fallbackMode,
                    reason: result.reason,
                    detectedAt: new Date().toISOString()
                });
                console.log(`⚠️ ${sdkName.toUpperCase()}: Not available - ${result.reason}`);
            }
        }
    }

    async detectLMStudioSDK() {
        try {
            // Method 1: Check for LM Studio CLI
            try {
                const { stdout } = await execAsync('lms --version', { timeout: this.config.sdkDetectionTimeout });
                const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    return {
                        available: true,
                        version: versionMatch[1],
                        path: 'lms (CLI)',
                        capabilities: await this.detectLMStudioCapabilities()
                    };
                }
            } catch (error) {
                // CLI not available, continue with other methods
            }

            // Method 2: Check for LM Studio API endpoint
            try {
                const { stdout } = await execAsync(`curl -s -m 2 http://localhost:${this.config.lmStudioDefaultPort}/v1/models`, { timeout: this.config.sdkDetectionTimeout });
                const response = JSON.parse(stdout);
                if (response && response.data && Array.isArray(response.data)) {
                    return {
                        available: true,
                        version: 'API-detected',
                        path: `http://localhost:${this.config.lmStudioDefaultPort}`,
                        capabilities: await this.detectLMStudioAPICapabilities()
                    };
                }
            } catch (error) {
                // API not available
            }

            // Method 3: Check for Node.js LM Studio SDK
            try {
                const packagePath = path.resolve(process.cwd(), 'node_modules/@lmstudio/sdk');
                await fs.access(packagePath);
                
                // Try to import and get version
                const sdkModule = await import('@lmstudio/sdk');
                return {
                    available: true,
                    version: sdkModule.version || 'installed',
                    path: packagePath,
                    capabilities: await this.detectLMStudioNodeCapabilities(sdkModule)
                };
            } catch (error) {
                // Node.js SDK not available
            }

            return {
                available: false,
                reason: 'LM Studio SDK not detected via CLI, API, or Node.js package'
            };

        } catch (error) {
            return {
                available: false,
                reason: `Detection error: ${error.message}`
            };
        }
    }

    async detectOllamaSDK() {
        try {
            // Method 1: Check for Ollama CLI
            try {
                const { stdout } = await execAsync('ollama --version', { timeout: this.config.sdkDetectionTimeout });
                const versionMatch = stdout.match(/ollama version is (\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    return {
                        available: true,
                        version: versionMatch[1],
                        path: 'ollama (CLI)',
                        capabilities: await this.detectOllamaCapabilities()
                    };
                }
            } catch (error) {
                // CLI not available, continue with other methods
            }

            // Method 2: Check for Ollama API endpoint
            try {
                const { stdout } = await execAsync(`curl -s -m 2 http://localhost:${this.config.ollamaDefaultPort}/api/tags`, { timeout: this.config.sdkDetectionTimeout });
                const response = JSON.parse(stdout);
                if (response && response.models && Array.isArray(response.models)) {
                    return {
                        available: true,
                        version: 'API-detected',
                        path: `http://localhost:${this.config.ollamaDefaultPort}`,
                        capabilities: await this.detectOllamaAPICapabilities()
                    };
                }
            } catch (error) {
                // API not available
            }

            // Method 3: Check for Node.js Ollama SDK
            try {
                const packagePath = path.resolve(process.cwd(), 'node_modules/ollama');
                await fs.access(packagePath);
                
                // Try to import and get version
                const sdkModule = await import('ollama');
                return {
                    available: true,
                    version: sdkModule.version || 'installed',
                    path: packagePath,
                    capabilities: await this.detectOllamaNodeCapabilities(sdkModule)
                };
            } catch (error) {
                // Node.js SDK not available
            }

            return {
                available: false,
                reason: 'Ollama SDK not detected via CLI, API, or Node.js package'
            };

        } catch (error) {
            return {
                available: false,
                reason: `Detection error: ${error.message}`
            };
        }
    }

    async detectLMStudioCapabilities() {
        return {
            streaming: true,
            toolCalling: false, // Most local models don't support tool calling
            multimodal: false,
            embeddings: true,
            completions: true,
            chat: true
        };
    }

    async detectLMStudioAPICapabilities() {
        try {
            const { stdout } = await execAsync(`curl -s http://localhost:${this.config.lmStudioDefaultPort}/v1/models`);
            const response = JSON.parse(stdout);
            
            return {
                streaming: true,
                toolCalling: false,
                multimodal: false,
                embeddings: response.data.some(model => model.id.includes('embed')),
                completions: true,
                chat: true,
                availableModels: response.data.map(model => model.id)
            };
        } catch (error) {
            return this.detectLMStudioCapabilities(); // Fallback to default capabilities
        }
    }

    async detectLMStudioNodeCapabilities(sdkModule) {
        try {
            // Detect capabilities from SDK module
            const capabilities = {
                streaming: typeof sdkModule.stream !== 'undefined',
                toolCalling: typeof sdkModule.tools !== 'undefined',
                multimodal: typeof sdkModule.vision !== 'undefined',
                embeddings: typeof sdkModule.embeddings !== 'undefined',
                completions: typeof sdkModule.completions !== 'undefined',
                chat: typeof sdkModule.chat !== 'undefined'
            };
            
            return capabilities;
        } catch (error) {
            return this.detectLMStudioCapabilities(); // Fallback to default capabilities
        }
    }

    async detectOllamaCapabilities() {
        return {
            streaming: true,
            toolCalling: false, // Most Ollama models don't support tool calling
            multimodal: true, // Ollama supports vision models
            embeddings: true,
            completions: true,
            chat: true
        };
    }

    async detectOllamaAPICapabilities() {
        try {
            const { stdout } = await execAsync(`curl -s http://localhost:${this.config.ollamaDefaultPort}/api/tags`);
            const response = JSON.parse(stdout);
            
            return {
                streaming: true,
                toolCalling: false,
                multimodal: response.models.some(model => model.name.includes('vision') || model.name.includes('llava')),
                embeddings: true,
                completions: true,
                chat: true,
                availableModels: response.models.map(model => model.name)
            };
        } catch (error) {
            return this.detectOllamaCapabilities(); // Fallback to default capabilities
        }
    }

    async detectOllamaNodeCapabilities(sdkModule) {
        try {
            // Detect capabilities from SDK module
            const capabilities = {
                streaming: typeof sdkModule.generate !== 'undefined',
                toolCalling: false, // Ollama Node SDK doesn't typically support tool calling
                multimodal: typeof sdkModule.chat !== 'undefined',
                embeddings: typeof sdkModule.embeddings !== 'undefined',
                completions: typeof sdkModule.generate !== 'undefined',
                chat: typeof sdkModule.chat !== 'undefined'
            };
            
            return capabilities;
        } catch (error) {
            return this.detectOllamaCapabilities(); // Fallback to default capabilities
        }
    }

    async initializeSDKConfigurations() {
        console.log('⚙️ Initializing SDK configurations...');
        
        for (const [sdkName, sdkInfo] of this.sdkCache) {
            if (sdkInfo.available) {
                try {
                    const config = await this.generateSDKConfiguration(sdkName, sdkInfo);
                    this.capabilityCache.set(sdkName, config);
                    console.log(`✅ ${sdkName.toUpperCase()}: Configuration generated`);
                } catch (error) {
                    console.warn(`⚠️ ${sdkName.toUpperCase()}: Configuration generation failed - ${error.message}`);
                }
            } else {
                // Generate fallback configuration
                const fallbackConfig = await this.generateFallbackConfiguration(sdkName);
                this.capabilityCache.set(sdkName, fallbackConfig);
                console.log(`⚡ ${sdkName.toUpperCase()}: Fallback configuration generated`);
            }
        }
    }

    async generateSDKConfiguration(sdkName, sdkInfo) {
        const baseConfig = {
            sdkName,
            available: sdkInfo.available,
            version: sdkInfo.version,
            path: sdkInfo.path,
            capabilities: sdkInfo.capabilities,
            strategy: 'official-sdk',
            createdAt: new Date().toISOString()
        };

        switch (sdkName) {
            case 'lmstudio':
                return {
                    ...baseConfig,
                    endpoint: sdkInfo.path.startsWith('http') ? sdkInfo.path : `http://localhost:${this.config.lmStudioDefaultPort}`,
                    compatibility: 'openai-compatible',
                    preprocessor: 'lmstudio-official',
                    performanceOptimizations: {
                        localServing: true,
                        streamingBuffer: 'minimal',
                        connectionReuse: true
                    }
                };

            case 'ollama':
                return {
                    ...baseConfig,
                    endpoint: sdkInfo.path.startsWith('http') ? sdkInfo.path : `http://localhost:${this.config.ollamaDefaultPort}`,
                    compatibility: 'standalone',
                    preprocessor: 'ollama-official',
                    performanceOptimizations: {
                        localServing: true,
                        streamingBuffer: 'smart',
                        connectionReuse: true,
                        modelCaching: true
                    }
                };

            default:
                throw new Error(`Unknown SDK: ${sdkName}`);
        }
    }

    async generateFallbackConfiguration(sdkName) {
        const baseConfig = {
            sdkName,
            available: false,
            strategy: 'fallback',
            createdAt: new Date().toISOString()
        };

        switch (sdkName) {
            case 'lmstudio':
                return {
                    ...baseConfig,
                    fallbackMode: 'openai-compatible',
                    endpoint: `http://localhost:${this.config.lmStudioDefaultPort}`,
                    preprocessor: 'openai-compatible-fallback',
                    compatibility: 'openai-compatible',
                    capabilities: {
                        streaming: true,
                        toolCalling: false,
                        multimodal: false,
                        embeddings: true,
                        completions: true,
                        chat: true
                    }
                };

            case 'ollama':
                return {
                    ...baseConfig,
                    fallbackMode: 'standalone-implementation',
                    endpoint: `http://localhost:${this.config.ollamaDefaultPort}`,
                    preprocessor: 'ollama-standalone-fallback',
                    compatibility: 'custom',
                    capabilities: {
                        streaming: true,
                        toolCalling: false,
                        multimodal: true,
                        embeddings: true,
                        completions: true,
                        chat: true
                    }
                };

            default:
                throw new Error(`Unknown SDK: ${sdkName}`);
        }
    }

    async selectStrategy(sdkName, requestType = 'chat') {
        if (!this.initialized) {
            await this.initialize();
        }

        const sdkConfig = this.capabilityCache.get(sdkName);
        if (!sdkConfig) {
            this.errorHandler.handleValidationError(
                'sdk-strategy-selection',
                sdkName,
                `SDK configuration not found. Available SDKs: ${Array.from(this.capabilityCache.keys()).join(', ')}`
            );
        }

        // Check capability compatibility
        const requiredCapability = this.mapRequestTypeToCapability(requestType);
        if (!sdkConfig.capabilities[requiredCapability]) {
            console.warn(`⚠️ ${sdkName.toUpperCase()}: Capability ${requiredCapability} not supported`);
        }

        const strategy = {
            sdkName,
            requestType,
            useOfficialSDK: sdkConfig.available && this.config.preferOfficialSDK,
            endpoint: sdkConfig.endpoint,
            preprocessor: sdkConfig.preprocessor,
            compatibility: sdkConfig.compatibility,
            performanceOptimizations: sdkConfig.performanceOptimizations || {},
            selectedAt: new Date().toISOString()
        };

        console.log(`✅ Strategy selected for ${sdkName}: ${strategy.useOfficialSDK ? 'Official SDK' : 'Fallback mode'}`);
        
        this.emit('strategySelected', strategy);
        return strategy;
    }

    mapRequestTypeToCapability(requestType) {
        const mapping = {
            'chat': 'chat',
            'completion': 'completions',
            'embedding': 'embeddings',
            'stream': 'streaming',
            'tool-call': 'toolCalling',
            'vision': 'multimodal'
        };

        return mapping[requestType] || 'chat';
    }

    async createClient(sdkName, strategy = null) {
        if (!strategy) {
            strategy = await this.selectStrategy(sdkName);
        }

        if (strategy.useOfficialSDK) {
            return await this.createOfficialSDKClient(sdkName, strategy);
        } else {
            return await this.createFallbackClient(sdkName, strategy);
        }
    }

    async createOfficialSDKClient(sdkName, strategy) {
        console.log(`🔌 Creating official SDK client for ${sdkName}...`);
        
        try {
            switch (sdkName) {
                case 'lmstudio':
                    const lmStudioSDK = await import('@lmstudio/sdk');
                    return new lmStudioSDK.LMStudioClient({
                        baseUrl: strategy.endpoint,
                        ...strategy.performanceOptimizations
                    });

                case 'ollama':
                    const ollamaSDK = await import('ollama');
                    return new ollamaSDK.Ollama({
                        host: strategy.endpoint,
                        ...strategy.performanceOptimizations
                    });

                default:
                    throw new Error(`Official SDK not supported for: ${sdkName}`);
            }
        } catch (error) {
            console.warn(`⚠️ Failed to create official SDK client for ${sdkName}: ${error.message}`);
            console.log(`🔄 Falling back to compatibility mode...`);
            
            // Automatically fallback to compatibility mode
            strategy.useOfficialSDK = false;
            return await this.createFallbackClient(sdkName, strategy);
        }
    }

    async createFallbackClient(sdkName, strategy) {
        console.log(`⚡ Creating fallback client for ${sdkName}...`);
        
        // Import existing provider clients as fallback
        try {
            switch (strategy.compatibility) {
                case 'openai-compatible':
                    // Use OpenAI-compatible client (fallback to existing v2.7.0 implementation)
                    try {
                        const { default: OpenAIClient } = await import('../../provider/openai/client.js');
                        return new OpenAIClient({
                            baseURL: strategy.endpoint,
                            apiKey: 'local-server', // Local servers often don't require real API keys
                            ...strategy.performanceOptimizations
                        });
                    } catch (importError) {
                        // Fallback to simple HTTP client if OpenAI client not available
                        console.warn(`⚠️ OpenAI client not available, using simple HTTP client: ${importError.message}`);
                        return await this.createStandaloneClient(sdkName, strategy);
                    }

                case 'standalone':
                case 'custom':
                    // Create custom implementation for standalone servers
                    return await this.createStandaloneClient(sdkName, strategy);

                default:
                    throw new Error(`Fallback compatibility mode not supported: ${strategy.compatibility}`);
            }
        } catch (error) {
            this.errorHandler.handleCriticalError(error, 'fallback-client-creation', {
                sdkName,
                strategy
            });
        }
    }

    async createStandaloneClient(sdkName, strategy) {
        // Create a simple HTTP client for standalone APIs
        return {
            sdkName,
            endpoint: strategy.endpoint,
            compatibility: strategy.compatibility,
            
            async chat(messages, options = {}) {
                const response = await fetch(`${strategy.endpoint}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages,
                        stream: options.stream || false,
                        ...options
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }
                
                return options.stream ? response.body : await response.json();
            },

            async generate(prompt, options = {}) {
                const response = await fetch(`${strategy.endpoint}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt,
                        stream: options.stream || false,
                        ...options
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }
                
                return options.stream ? response.body : await response.json();
            }
        };
    }

    async getAvailableModels(sdkName) {
        const strategy = await this.selectStrategy(sdkName);
        const client = await this.createClient(sdkName, strategy);
        
        try {
            switch (sdkName) {
                case 'lmstudio':
                    if (strategy.useOfficialSDK) {
                        return await client.llm.list();
                    } else {
                        // Fallback to API call
                        const response = await fetch(`${strategy.endpoint}/v1/models`);
                        const data = await response.json();
                        return data.data.map(model => model.id);
                    }

                case 'ollama':
                    if (strategy.useOfficialSDK) {
                        const response = await client.list();
                        return response.models.map(model => model.name);
                    } else {
                        // Fallback to API call
                        const response = await fetch(`${strategy.endpoint}/api/tags`);
                        const data = await response.json();
                        return data.models.map(model => model.name);
                    }

                default:
                    throw new Error(`Model listing not supported for: ${sdkName}`);
            }
        } catch (error) {
            console.warn(`⚠️ Failed to get models for ${sdkName}: ${error.message}`);
            return [];
        }
    }

    async validateConfiguration(sdkName) {
        const config = this.capabilityCache.get(sdkName);
        if (!config) {
            return { valid: false, reason: 'Configuration not found' };
        }

        try {
            // Test endpoint connectivity
            const response = await fetch(`${config.endpoint}/health`, {
                method: 'GET',
                timeout: 5000
            });

            return {
                valid: response.ok,
                status: response.status,
                endpoint: config.endpoint,
                sdkAvailable: config.available,
                strategy: config.strategy
            };
        } catch (error) {
            return {
                valid: false,
                reason: error.message,
                endpoint: config.endpoint,
                sdkAvailable: config.available,
                strategy: config.strategy
            };
        }
    }

    getSDKStatus() {
        return {
            initialized: this.initialized,
            availableSDKs: Object.fromEntries(this.sdkCache),
            configurations: Object.fromEntries(this.capabilityCache),
            config: this.config
        };
    }
}

export default LMStudioOllamaSDKManager;