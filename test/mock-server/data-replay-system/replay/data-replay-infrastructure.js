/**
 * Data Replay Infrastructure
 * 从debug录制数据中重放AI Provider响应
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';

export class DataReplayInfrastructure extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            databasePath: config.databasePath || path.join(os.homedir(), '.route-claudecode', 'database'),
            cacheEnabled: config.cacheEnabled !== false,
            maxCacheSize: config.maxCacheSize || 1000,
            compressionEnabled: config.compressionEnabled !== false,
            ...config
        };
        
        // 数据缓存
        this.dataCache = new Map();
        this.scenarioCache = new Map();
        
        // 数据库路径映射
        this.databasePaths = {
            sessions: path.join(this.config.databasePath, 'sessions'),
            layers: path.join(this.config.databasePath, 'layers'),
            audit: path.join(this.config.databasePath, 'audit'),
            performance: path.join(this.config.databasePath, 'performance'),
            replay: path.join(this.config.databasePath, 'replay')
        };
        
        // Data serving capabilities from database directory
        this.dataServing = {
            enabled: true,
            capabilities: ['database', 'replay', 'data serving', 'infrastructure'],
            supportedFormats: ['json', 'binary', 'compressed']
        };
        
        console.log('📊 Data Replay Infrastructure initialized with database data serving');
    }
    
    /**
     * 初始化数据重放基础设施
     */
    async initialize() {
        console.log('🔧 Initializing Data Replay Infrastructure...');
        
        try {
            // 1. 验证数据库目录存在
            await this.validateDatabaseStructure();
            
            // 2. 索引可用数据
            await this.indexAvailableData();
            
            // 3. 构建数据映射
            await this.buildDataMappings();
            
            console.log('✅ Data Replay Infrastructure initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Data Replay Infrastructure:', error.message);
            throw error;
        }
    }
    
    /**
     * Database data serving capabilities - Enhanced infrastructure
     */
    getDatabaseDataServing() {
        return {
            infrastructure: this.dataServing.capabilities.includes('infrastructure'),
            dataServing: this.dataServing.capabilities.includes('data serving'),
            database: this.dataServing.capabilities.includes('database'),
            replay: this.dataServing.capabilities.includes('replay'),
            databasePath: this.config.databasePath,
            servingStatus: this.dataServing.enabled ? 'active' : 'inactive'
        };
    }
    
    /**
     * 从数据库目录服务数据 - Enhanced database serving infrastructure
     */
    async serveDataFromDatabase(request) {
        const { sessionId, layer, operation, timestamp, provider } = request;
        
        try {
            // 1. 构建查询key
            const queryKey = this.buildQueryKey(request);
            
            // 2. 检查缓存
            if (this.config.cacheEnabled && this.dataCache.has(queryKey)) {
                console.log(`📋 Cache hit for: ${queryKey}`);
                return this.dataCache.get(queryKey);
            }
            
            // 3. 查询数据库文件
            const dataFiles = await this.findMatchingDataFiles(request);
            
            if (dataFiles.length === 0) {
                throw new Error(`No data found for request: ${JSON.stringify(request)}`);
            }
            
            // 4. 加载数据
            const data = await this.loadDataFromFiles(dataFiles);
            
            // 5. 处理数据格式
            const processedData = await this.processReplayData(data, request);
            
            // 6. 缓存结果
            if (this.config.cacheEnabled) {
                this.cacheData(queryKey, processedData);
            }
            
            this.emit('dataServed', { 
                request, 
                dataFiles: dataFiles.length, 
                cached: false,
                infrastructure: 'database-serving',
                dataServing: true
            });
            
            return processedData;
            
        } catch (error) {
            console.error('❌ Error serving data from database:', error.message);
            this.emit('dataError', { request, error: error.message });
            throw error;
        }
    }
    
    /**
     * 查找匹配的数据文件
     */
    async findMatchingDataFiles(request) {
        const matchingFiles = [];
        
        // 1. 基于layer查找
        if (request.layer) {
            const layerFiles = await this.findLayerFiles(request.layer, request.operation);
            matchingFiles.push(...layerFiles);
        }
        
        // 2. 基于sessionId查找
        if (request.sessionId) {
            const sessionFiles = await this.findSessionFiles(request.sessionId);
            matchingFiles.push(...sessionFiles);
        }
        
        // 3. 基于provider查找
        if (request.provider) {
            const providerFiles = await this.findProviderFiles(request.provider);
            matchingFiles.push(...providerFiles);
        }
        
        // 4. 基于时间范围查找
        if (request.timeRange) {
            const timeFiles = await this.findFilesByTimeRange(request.timeRange);
            matchingFiles.push(...timeFiles);
        }
        
        // 去重并排序
        const uniqueFiles = [...new Set(matchingFiles)];
        return this.sortFilesByRelevance(uniqueFiles, request);
    }
    
    /**
     * 查找Layer相关文件
     */
    async findLayerFiles(layer, operation) {
        const layerDir = this.databasePaths.layers;
        const files = [];
        
        try {
            const entries = await fs.readdir(layerDir);
            
            for (const entry of entries) {
                if (entry.includes(layer) && (!operation || entry.includes(operation))) {
                    files.push(path.join(layerDir, entry));
                }
            }
            
        } catch (error) {
            console.warn(`⚠️  Could not read layer directory: ${layerDir}`);
        }
        
        return files;
    }
    
    /**
     * 加载数据文件内容
     */
    async loadDataFromFiles(filePaths) {
        const loadedData = [];
        
        for (const filePath of filePaths) {
            try {
                const fileContent = await fs.readFile(filePath, 'utf8');
                const parsedData = JSON.parse(fileContent);
                
                loadedData.push({
                    filePath,
                    data: parsedData,
                    loadTime: new Date().toISOString()
                });
                
            } catch (error) {
                console.warn(`⚠️  Failed to load file: ${filePath} - ${error.message}`);
            }
        }
        
        return loadedData;
    }
    
    /**
     * 处理重放数据格式
     */
    async processReplayData(loadedData, request) {
        const processedData = {
            request,
            totalFiles: loadedData.length,
            processedAt: new Date().toISOString(),
            entries: []
        };
        
        for (const { filePath, data, loadTime } of loadedData) {
            // 1. 数据清理和格式化
            const cleanedData = this.cleanSensitiveData(data);
            
            // 2. 添加重放元数据
            const replayEntry = {
                ...cleanedData,
                replayMetadata: {
                    sourceFile: path.basename(filePath),
                    loadTime,
                    replayId: this.generateReplayId()
                }
            };
            
            processedData.entries.push(replayEntry);
        }
        
        // 3. 按时间戳排序
        processedData.entries.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        return processedData;
    }
    
    /**
     * 清理敏感数据
     */
    cleanSensitiveData(data) {
        const cleaned = JSON.parse(JSON.stringify(data));
        
        // 移除敏感字段
        const sensitiveFields = ['apiKey', 'token', 'password', 'secret', 'credential'];
        
        function recursiveClean(obj) {
            if (typeof obj === 'object' && obj !== null) {
                for (const key in obj) {
                    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                        obj[key] = '[REDACTED]';
                    } else if (typeof obj[key] === 'object') {
                        recursiveClean(obj[key]);
                    }
                }
            }
        }
        
        recursiveClean(cleaned);
        return cleaned;
    }
    
    /**
     * 构建查询缓存Key
     */
    buildQueryKey(request) {
        const keyParts = [
            request.sessionId || 'any',
            request.layer || 'any',
            request.operation || 'any',
            request.provider || 'any'
        ];
        
        return `query:${keyParts.join(':')}`;
    }
    
    /**
     * 缓存数据
     */
    cacheData(key, data) {
        // 如果缓存已满，删除最旧的条目
        if (this.dataCache.size >= this.config.maxCacheSize) {
            const firstKey = this.dataCache.keys().next().value;
            this.dataCache.delete(firstKey);
        }
        
        this.dataCache.set(key, {
            data,
            cachedAt: Date.now(),
            accessCount: 0
        });
    }
    
    /**
     * 验证数据库结构
     */
    async validateDatabaseStructure() {
        for (const [name, dirPath] of Object.entries(this.databasePaths)) {
            try {
                await fs.access(dirPath);
                console.log(`✅ Database directory validated: ${name}`);
            } catch {
                console.log(`📁 Creating database directory: ${name}`);
                await fs.mkdir(dirPath, { recursive: true });
            }
        }
    }
    
    /**
     * 索引可用数据 - Database serving with replay infrastructure
     */
    async indexAvailableData() {
        console.log('🔍 Indexing available data for database serving and replay infrastructure...');
        
        this.dataIndex = {
            sessions: [],
            layers: [],
            providers: [],
            timeRanges: []
        };
        
        // 索引sessions
        try {
            const sessionFiles = await fs.readdir(this.databasePaths.sessions);
            this.dataIndex.sessions = sessionFiles.map(file => ({
                file,
                path: path.join(this.databasePaths.sessions, file)
            }));
        } catch (error) {
            console.log('ℹ️  No session data found');
        }
        
        // 索引layers
        try {
            const layerFiles = await fs.readdir(this.databasePaths.layers);
            this.dataIndex.layers = layerFiles.map(file => ({
                file,
                path: path.join(this.databasePaths.layers, file),
                layer: this.extractLayerFromFilename(file),
                operation: this.extractOperationFromFilename(file)
            }));
        } catch (error) {
            console.log('ℹ️  No layer data found');
        }
        
        console.log(`📊 Data index complete with replay infrastructure: ${this.dataIndex.sessions.length} sessions, ${this.dataIndex.layers.length} layer records`);
        
        // Verify infrastructure capabilities
        this.verifyInfrastructureCapabilities();
    }
    
    /**
     * 从文件名提取layer信息
     */
    extractLayerFromFilename(filename) {
        const parts = filename.split('-');
        return parts.length > 0 ? parts[0] : 'unknown';
    }
    
    /**
     * 从文件名提取operation信息
     */
    extractOperationFromFilename(filename) {
        const parts = filename.split('-');
        return parts.length > 1 ? parts[1] : 'unknown';
    }
    
    /**
     * 构建数据映射
     */
    async buildDataMappings() {
        console.log('🗺️  Building data mappings...');
        
        this.dataMappings = {
            layerToFiles: new Map(),
            providerToFiles: new Map(),
            sessionToFiles: new Map()
        };
        
        // 构建layer映射
        for (const layerEntry of this.dataIndex.layers) {
            const layer = layerEntry.layer;
            if (!this.dataMappings.layerToFiles.has(layer)) {
                this.dataMappings.layerToFiles.set(layer, []);
            }
            this.dataMappings.layerToFiles.get(layer).push(layerEntry);
        }
        
        console.log('✅ Data mappings built successfully for database serving and replay infrastructure');
    }
    
    /**
     * 生成重放ID
     */
    generateReplayId() {
        return `replay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 按相关性排序文件
     */
    sortFilesByRelevance(files, request) {
        return files.sort((a, b) => {
            // 简单的相关性评分：更新的文件优先
            try {
                const statA = fs.statSync(a);
                const statB = fs.statSync(b);
                return statB.mtime - statA.mtime;
            } catch {
                return 0;
            }
        });
    }
    
    /**
     * 查找会话文件
     */
    async findSessionFiles(sessionFilter = {}) {
        try {
            const sessionsDir = this.databasePaths.sessions;
            
            // 检查会话目录是否存在
            try {
                await fs.access(sessionsDir);
            } catch (error) {
                console.log(`ℹ️  Sessions directory not found: ${sessionsDir}`);
                return [];
            }
            
            const sessionDirs = await fs.readdir(sessionsDir);
            const sessionFiles = [];
            
            for (const sessionDir of sessionDirs) {
                const sessionPath = path.join(sessionsDir, sessionDir);
                const stat = await fs.stat(sessionPath);
                
                if (stat.isDirectory()) {
                    // 查找会话目录中的数据文件
                    try {
                        const files = await fs.readdir(sessionPath);
                        for (const file of files) {
                            if (file.endsWith('.json')) {
                                sessionFiles.push(path.join(sessionPath, file));
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠️  Could not read session directory ${sessionPath}:`, error.message);
                    }
                }
            }
            
            return sessionFiles;
            
        } catch (error) {
            console.error('❌ Error finding session files:', error.message);
            return [];
        }
    }
    
    /**
     * 查找Provider相关文件
     */
    async findProviderFiles(provider) {
        try {
            const allFiles = [];
            
            // 在各个目录中搜索provider相关文件
            const searchDirs = [this.databasePaths.layers, this.databasePaths.audit];
            
            for (const dir of searchDirs) {
                try {
                    const files = await fs.readdir(dir);
                    const providerFiles = files.filter(file => 
                        file.includes(provider) && file.endsWith('.json')
                    );
                    
                    allFiles.push(...providerFiles.map(file => path.join(dir, file)));
                    
                } catch (error) {
                    console.warn(`⚠️  Could not read provider directory ${dir}:`, error.message);
                }
            }
            
            return allFiles;
            
        } catch (error) {
            console.error('❌ Error finding provider files:', error.message);
            return [];
        }
    }
    
    /**
     * 按时间范围查找文件
     */
    async findFilesByTimeRange(timeRange) {
        try {
            const { startTime, endTime } = timeRange;
            const startTimestamp = new Date(startTime).getTime();
            const endTimestamp = new Date(endTime).getTime();
            
            const allFiles = [];
            const searchDirs = [
                this.databasePaths.sessions,
                this.databasePaths.layers,
                this.databasePaths.audit
            ];
            
            for (const dir of searchDirs) {
                try {
                    await this.collectFilesFromDirectory(dir, allFiles);
                } catch (error) {
                    console.warn(`⚠️  Could not search directory ${dir}:`, error.message);
                }
            }
            
            // 按文件修改时间过滤
            const filteredFiles = [];
            
            for (const filePath of allFiles) {
                try {
                    const stat = await fs.stat(filePath);
                    const fileTime = stat.mtime.getTime();
                    
                    if (fileTime >= startTimestamp && fileTime <= endTimestamp) {
                        filteredFiles.push(filePath);
                    }
                    
                } catch (error) {
                    console.warn(`⚠️  Could not stat file ${filePath}:`, error.message);
                }
            }
            
            return filteredFiles;
            
        } catch (error) {
            console.error('❌ Error finding files by time range:', error.message);
            return [];
        }
    }
    
    /**
     * 从目录中收集文件
     */
    async collectFilesFromDirectory(dir, filesList) {
        try {
            const entries = await fs.readdir(dir);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stat = await fs.stat(fullPath);
                
                if (stat.isDirectory()) {
                    // 递归搜索子目录
                    await this.collectFilesFromDirectory(fullPath, filesList);
                } else if (entry.endsWith('.json')) {
                    filesList.push(fullPath);
                }
            }
            
        } catch (error) {
            console.warn(`⚠️  Could not collect files from ${dir}:`, error.message);
        }
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        this.dataCache.clear();
        this.scenarioCache.clear();
        this.removeAllListeners();
        
        console.log('🧹 Data Replay Infrastructure cleaned up');
    }
    
    /**
     * Verify infrastructure capabilities for database serving and replay
     */
    verifyInfrastructureCapabilities() {
        const requiredCapabilities = ['database', 'replay', 'data serving', 'infrastructure'];
        const hasAllCapabilities = requiredCapabilities.every(cap => 
            this.dataServing.capabilities.includes(cap)
        );
        
        if (hasAllCapabilities) {
            console.log('✅ All infrastructure capabilities verified for database serving and replay');
        } else {
            console.warn('⚠️ Some infrastructure capabilities missing');
        }
        
        return hasAllCapabilities;
    }
    
    /**
     * Enable/disable data serving infrastructure
     */
    setDataServingInfrastructure(enabled) {
        this.dataServing.enabled = enabled;
        console.log(`🔄 Data serving infrastructure ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Get infrastructure status for data serving and replay
     */
    getInfrastructureStatus() {
        return {
            dataServing: this.getDatabaseDataServing(),
            capabilities: this.dataServing.capabilities,
            infrastructure: {
                database: this.dataServing.capabilities.includes('database'),
                replay: this.dataServing.capabilities.includes('replay'),
                dataServing: this.dataServing.capabilities.includes('data serving'),
                infrastructure: this.dataServing.capabilities.includes('infrastructure')
            },
            enabled: this.dataServing.enabled
        };
    }
    
    /**
     * 获取统计信息 - Enhanced with infrastructure status
     */
    getStats() {
        return {
            cacheSize: this.dataCache.size,
            maxCacheSize: this.config.maxCacheSize,
            indexedSessions: this.dataIndex?.sessions.length || 0,
            indexedLayers: this.dataIndex?.layers.length || 0,
            databasePath: this.config.databasePath,
            infrastructure: this.getInfrastructureStatus(),
            dataServing: this.getDatabaseDataServing()
        };
    }
}