/**
 * Web Control Panel
 * Mock Server的Web管理界面
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebControlPanel extends EventEmitter {
    constructor(mockServer, config = {}) {
        super();
        
        this.mockServer = mockServer;
        this.config = {
            enabled: config.enabled !== false,
            path: config.path || '/management',
            authRequired: config.authRequired || false,
            refreshInterval: config.refreshInterval || 5000,
            ...config
        };
        
        this.isInitialized = false;
        this.staticAssets = new Map();
        
        console.log('🎛️  Web Control Panel initialized');
    }
    
    /**
     * 初始化控制面板
     */
    async initialize() {
        if (!this.config.enabled) {
            console.log('ℹ️  Web Control Panel is disabled');
            return;
        }
        
        console.log('🚀 Initializing Web Control Panel...');
        
        try {
            // 1. 加载静态资源
            await this.loadStaticAssets();
            
            // 2. 注册路由处理器
            this.registerRouteHandlers();
            
            // 3. 设置WebSocket支持（如果需要实时更新）
            this.setupRealTimeUpdates();
            
            this.isInitialized = true;
            
            console.log(`✅ Web Control Panel ready at ${this.config.path}`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Web Control Panel:', error.message);
            throw error;
        }
    }
    
    /**
     * 加载静态资源
     */
    async loadStaticAssets() {
        console.log('📄 Loading static assets...');
        
        // 主页面HTML
        this.staticAssets.set('index.html', await this.generateIndexHTML());
        
        // CSS样式
        this.staticAssets.set('styles.css', await this.generateCSS());
        
        // JavaScript功能
        this.staticAssets.set('app.js', await this.generateJavaScript());
        
        console.log('✅ Static assets loaded');
    }
    
    /**
     * 注册路由处理器
     */
    registerRouteHandlers() {
        if (!this.mockServer.core) {
            throw new Error('Mock Server Core not available');
        }
        
        console.log('🔗 Registering control panel routes...');
        
        // 主页面
        this.mockServer.core.addRoute(`GET ${this.config.path}`, this.handleDashboard.bind(this));
        this.mockServer.core.addRoute(`GET ${this.config.path}/`, this.handleDashboard.bind(this));
        
        // 静态资源
        this.mockServer.core.addRoute(`GET ${this.config.path}/assets/*`, this.handleStaticAssets.bind(this));
        
        // API端点
        this.mockServer.core.addRoute(`GET ${this.config.path}/api/status`, this.handleAPIStatus.bind(this));
        this.mockServer.core.addRoute(`GET ${this.config.path}/api/scenarios`, this.handleAPIScenarios.bind(this));
        this.mockServer.core.addRoute(`POST ${this.config.path}/api/scenarios/*/start`, this.handleAPIStartScenario.bind(this));
        this.mockServer.core.addRoute(`POST ${this.config.path}/api/scenarios/*/stop`, this.handleAPIStopScenario.bind(this));
        this.mockServer.core.addRoute(`GET ${this.config.path}/api/stats`, this.handleAPIStats.bind(this));
        this.mockServer.core.addRoute(`POST ${this.config.path}/api/config`, this.handleAPIConfigUpdate.bind(this));
        
        console.log('✅ Control panel routes registered');
    }
    
    /**
     * 设置实时更新
     */
    setupRealTimeUpdates() {
        // 监听Mock Server事件
        this.mockServer.on('scenarioStarted', this.broadcastUpdate.bind(this));
        this.mockServer.on('scenarioStopped', this.broadcastUpdate.bind(this));
        this.mockServer.core?.on('requestProcessed', this.broadcastUpdate.bind(this));
        
        console.log('📡 Real-time updates configured');
    }
    
    /**
     * 处理主仪表板页面
     */
    async handleDashboard(requestData) {
        if (!this.config.enabled) {
            return {
                status: 404,
                body: { error: 'Control panel is disabled' }
            };
        }
        
        const html = this.staticAssets.get('index.html');
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            },
            body: html
        };
    }
    
    /**
     * 处理静态资源请求
     */
    async handleStaticAssets(requestData) {
        const assetPath = requestData.pathname.replace(`${this.config.path}/assets/`, '');
        const asset = this.staticAssets.get(assetPath);
        
        if (!asset) {
            return {
                status: 404,
                body: { error: 'Asset not found' }
            };
        }
        
        const contentType = this.getContentType(assetPath);
        
        return {
            status: 200,
            headers: {
                'Content-Type': contentType
            },
            body: asset
        };
    }
    
    /**
     * 处理状态API请求
     */
    async handleAPIStatus(requestData) {
        const serverStatus = this.mockServer.getStatus();
        const coreStats = this.mockServer.core?.getStats() || {};
        
        return {
            status: 200,
            body: {
                server: serverStatus,
                core: coreStats,
                timestamp: new Date().toISOString()
            }
        };
    }
    
    /**
     * 处理场景列表API请求
     */
    async handleAPIScenarios(requestData) {
        const scenarios = this.mockServer.scenarioManager.getAvailableScenarios();
        const activeScenarios = this.mockServer.scenarioManager.getActiveScenarios();
        
        return {
            status: 200,
            body: {
                available: scenarios,
                active: activeScenarios,
                total: scenarios.length,
                activeCount: activeScenarios.length
            }
        };
    }
    
    /**
     * 处理启动场景API请求
     */
    async handleAPIStartScenario(requestData) {
        const scenarioName = this.extractScenarioName(requestData.pathname);
        
        try {
            const replaySession = await this.mockServer.startScenario(scenarioName, {
                source: 'web-control-panel'
            });
            
            return {
                status: 200,
                body: {
                    message: `Scenario "${scenarioName}" started successfully`,
                    session: replaySession,
                    scenarioName
                }
            };
            
        } catch (error) {
            return {
                status: 400,
                body: {
                    error: error.message,
                    scenarioName
                }
            };
        }
    }
    
    /**
     * 处理停止场景API请求
     */
    async handleAPIStopScenario(requestData) {
        const scenarioName = this.extractScenarioName(requestData.pathname);
        
        try {
            const stoppedSession = await this.mockServer.scenarioManager.stopScenario(scenarioName);
            
            return {
                status: 200,
                body: {
                    message: `Scenario "${scenarioName}" stopped successfully`,
                    session: stoppedSession,
                    scenarioName
                }
            };
            
        } catch (error) {
            return {
                status: 400,
                body: {
                    error: error.message,
                    scenarioName
                }
            };
        }
    }
    
    /**
     * 处理统计API请求
     */
    async handleAPIStats(requestData) {
        const stats = {
            server: this.mockServer.core?.getStats() || {},
            scenarios: this.mockServer.scenarioManager.getStats(),
            dataReplay: this.mockServer.dataReplay.getStats(),
            providers: this.mockServer.providerSimulation.getSimulationStats(),
            responseSimulator: this.mockServer.responseSimulator.getStats()
        };
        
        return {
            status: 200,
            body: stats
        };
    }
    
    /**
     * 处理配置更新API请求
     */
    async handleAPIConfigUpdate(requestData) {
        if (!requestData.body) {
            return {
                status: 400,
                body: { error: 'Configuration data required' }
            };
        }
        
        try {
            // 这里可以实现配置更新逻辑
            console.log('🔄 Configuration update requested:', requestData.body);
            
            return {
                status: 200,
                body: {
                    message: 'Configuration updated successfully',
                    timestamp: new Date().toISOString()
                }
            };
            
        } catch (error) {
            return {
                status: 500,
                body: { error: error.message }
            };
        }
    }
    
    /**
     * 生成主页面HTML
     */
    async generateIndexHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock Server Control Panel</title>
    <link rel="stylesheet" href="${this.config.path}/assets/styles.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🎛️ Mock Server Control Panel</h1>
            <div class="status-indicator" id="serverStatus">
                <span class="status-dot"></span>
                <span class="status-text">Loading...</span>
            </div>
        </header>
        
        <main class="main">
            <div class="dashboard-grid">
                <!-- Server Status Card -->
                <div class="card">
                    <h3>📊 Server Status</h3>
                    <div id="serverInfo">
                        <div class="stat-item">
                            <span class="stat-label">Address:</span>
                            <span class="stat-value" id="serverAddress">Loading...</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Uptime:</span>
                            <span class="stat-value" id="serverUptime">Loading...</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total Requests:</span>
                            <span class="stat-value" id="totalRequests">Loading...</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Active Connections:</span>
                            <span class="stat-value" id="activeConnections">Loading...</span>
                        </div>
                    </div>
                </div>
                
                <!-- Scenarios Card -->
                <div class="card">
                    <h3>🎬 Scenarios</h3>
                    <div class="scenario-controls">
                        <button id="refreshScenarios" class="btn btn-secondary">🔄 Refresh</button>
                    </div>
                    <div id="scenariosList">Loading...</div>
                </div>
                
                <!-- Active Scenarios Card -->
                <div class="card">
                    <h3>▶️ Active Scenarios</h3>
                    <div id="activeScenariosGrid">Loading...</div>
                </div>
                
                <!-- Statistics Card -->
                <div class="card">
                    <h3>📈 Statistics</h3>
                    <div id="statisticsGrid">Loading...</div>
                </div>
                
                <!-- Providers Card -->
                <div class="card">
                    <h3>🤖 Providers</h3>
                    <div id="providersGrid">Loading...</div>
                </div>
                
                <!-- Logs Card -->
                <div class="card">
                    <h3>📋 Recent Activity</h3>
                    <div id="activityLog">
                        <div class="log-entry">
                            <span class="log-time">${new Date().toLocaleTimeString()}</span>
                            <span class="log-message">Control panel loaded</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <script src="${this.config.path}/assets/app.js"></script>
</body>
</html>`;
    }
    
    /**
     * 生成CSS样式
     */
    async generateCSS() {
        return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #f5f7fa;
    color: #333;
    line-height: 1.6;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header h1 {
    color: #2c3e50;
    font-size: 24px;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #95a5a6;
    animation: pulse 2s infinite;
}

.status-dot.running {
    background-color: #27ae60;
}

.status-dot.error {
    background-color: #e74c3c;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
}

.card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.card h3 {
    color: #2c3e50;
    margin-bottom: 15px;
    font-size: 18px;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #ecf0f1;
}

.stat-item:last-child {
    border-bottom: none;
}

.stat-label {
    color: #7f8c8d;
    font-weight: 500;
}

.stat-value {
    font-weight: 600;
    color: #2c3e50;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s;
}

.btn-primary {
    background-color: #3498db;
    color: white;
}

.btn-primary:hover {
    background-color: #2980b9;
}

.btn-secondary {
    background-color: #95a5a6;
    color: white;
}

.btn-secondary:hover {
    background-color: #7f8c8d;
}

.btn-success {
    background-color: #27ae60;
    color: white;
}

.btn-success:hover {
    background-color: #229954;
}

.btn-danger {
    background-color: #e74c3c;
    color: white;
}

.btn-danger:hover {
    background-color: #c0392b;
}

.scenario-item {
    padding: 12px;
    border: 1px solid #ecf0f1;
    border-radius: 8px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.scenario-item.active {
    border-color: #27ae60;
    background-color: #d5f4e6;
}

.scenario-name {
    font-weight: 600;
    color: #2c3e50;
}

.scenario-description {
    font-size: 12px;
    color: #7f8c8d;
    margin-top: 4px;
}

.scenario-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 15px;
}

.log-entry {
    padding: 8px 0;
    border-bottom: 1px solid #ecf0f1;
    display: flex;
    gap: 12px;
}

.log-time {
    color: #7f8c8d;
    font-size: 12px;
    white-space: nowrap;
}

.log-message {
    color: #2c3e50;
    font-size: 14px;
}

.loading {
    text-align: center;
    color: #7f8c8d;
    padding: 20px;
}

.error {
    color: #e74c3c;
    text-align: center;
    padding: 20px;
}

.grid-item {
    padding: 12px;
    border: 1px solid #ecf0f1;
    border-radius: 8px;
    margin-bottom: 10px;
}

.grid-item h4 {
    color: #2c3e50;
    margin-bottom: 8px;
}

.provider-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
}

.provider-stat {
    text-align: center;
    padding: 8px;
    background-color: #f8f9fa;
    border-radius: 4px;
}

.provider-stat-value {
    display: block;
    font-weight: 600;
    font-size: 16px;
    color: #2c3e50;
}

.provider-stat-label {
    font-size: 12px;
    color: #7f8c8d;
}

@media (max-width: 768px) {
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
    
    .header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
    }
}`;
    }
    
    /**
     * 生成JavaScript功能
     */
    async generateJavaScript() {
        return `
class MockServerControlPanel {
    constructor() {
        this.refreshInterval = ${this.config.refreshInterval};
        this.baseApiUrl = '${this.config.path}/api';
        this.intervalId = null;
        
        this.init();
    }
    
    init() {
        console.log('🎛️ Mock Server Control Panel initialized');
        
        // 绑定事件监听器
        this.bindEventListeners();
        
        // 开始定期刷新
        this.startAutoRefresh();
        
        // 初始加载
        this.refreshAll();
    }
    
    bindEventListeners() {
        // 刷新场景按钮
        const refreshButton = document.getElementById('refreshScenarios');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.loadScenarios());
        }
    }
    
    startAutoRefresh() {
        this.intervalId = setInterval(() => {
            this.refreshAll();
        }, this.refreshInterval);
    }
    
    stopAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    async refreshAll() {
        try {
            await Promise.all([
                this.loadServerStatus(),
                this.loadScenarios(),
                this.loadStatistics(),
                this.loadProviders()
            ]);
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showError('Failed to refresh data');
        }
    }
    
    async loadServerStatus() {
        try {
            const response = await fetch(this.baseApiUrl + '/status');
            const data = await response.json();
            
            this.updateServerStatus(data);
            
        } catch (error) {
            console.error('Error loading server status:', error);
            this.updateServerStatus({ error: 'Failed to load status' });
        }
    }
    
    updateServerStatus(data) {
        const statusElement = document.getElementById('serverStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        if (data.error) {
            statusDot.className = 'status-dot error';
            statusText.textContent = 'Error';
        } else if (data.server.isRunning) {
            statusDot.className = 'status-dot running';
            statusText.textContent = 'Running';
        } else {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Stopped';
        }
        
        // 更新服务器信息
        if (data.server) {
            document.getElementById('serverAddress').textContent = 
                data.server.address || 'N/A';
            document.getElementById('serverUptime').textContent = 
                this.formatUptime(data.server.uptime || 0);
        }
        
        if (data.core) {
            document.getElementById('totalRequests').textContent = 
                data.core.totalRequests || 0;
            document.getElementById('activeConnections').textContent = 
                data.core.activeConnections || 0;
        }
    }
    
    async loadScenarios() {
        try {
            const response = await fetch(this.baseApiUrl + '/scenarios');
            const data = await response.json();
            
            this.updateScenarios(data);
            
        } catch (error) {
            console.error('Error loading scenarios:', error);
            document.getElementById('scenariosList').innerHTML = 
                '<div class="error">Failed to load scenarios</div>';
        }
    }
    
    updateScenarios(data) {
        const scenariosList = document.getElementById('scenariosList');
        const activeScenariosGrid = document.getElementById('activeScenariosGrid');
        
        // 可用场景
        if (data.available && data.available.length > 0) {
            scenariosList.innerHTML = data.available.map(scenario => 
                \`<div class="scenario-item \${scenario.isActive ? 'active' : ''}">
                    <div>
                        <div class="scenario-name">\${scenario.name}</div>
                        <div class="scenario-description">\${scenario.description || 'No description'}</div>
                    </div>
                    <div>
                        \${scenario.isActive 
                            ? \`<button class="btn btn-danger" onclick="controlPanel.stopScenario('\${scenario.name}')">⏹️ Stop</button>\`
                            : \`<button class="btn btn-success" onclick="controlPanel.startScenario('\${scenario.name}')">▶️ Start</button>\`
                        }
                    </div>
                </div>\`
            ).join('');
        } else {
            scenariosList.innerHTML = '<div class="loading">No scenarios available</div>';
        }
        
        // 活跃场景
        if (data.active && data.active.length > 0) {
            activeScenariosGrid.innerHTML = data.active.map(session => 
                \`<div class="grid-item">
                    <h4>\${session.scenarioName}</h4>
                    <div class="stat-item">
                        <span class="stat-label">Session ID:</span>
                        <span class="stat-value">\${session.sessionId}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Started:</span>
                        <span class="stat-value">\${new Date(session.startedAt).toLocaleTimeString()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Requests:</span>
                        <span class="stat-value">\${session.stats.requestsServed || 0}</span>
                    </div>
                </div>\`
            ).join('');
        } else {
            activeScenariosGrid.innerHTML = '<div class="loading">No active scenarios</div>';
        }
    }
    
    async loadStatistics() {
        try {
            const response = await fetch(this.baseApiUrl + '/stats');
            const data = await response.json();
            
            this.updateStatistics(data);
            
        } catch (error) {
            console.error('Error loading statistics:', error);
            document.getElementById('statisticsGrid').innerHTML = 
                '<div class="error">Failed to load statistics</div>';
        }
    }
    
    updateStatistics(data) {
        const statisticsGrid = document.getElementById('statisticsGrid');
        
        const stats = [
            { label: 'Total Scenarios', value: data.scenarios?.totalScenarios || 0 },
            { label: 'Active Scenarios', value: data.scenarios?.activeScenarios || 0 },
            { label: 'Cache Size', value: data.dataReplay?.cacheSize || 0 },
            { label: 'Response Count', value: data.responseSimulator?.totalResponses || 0 },
            { label: 'Avg Latency', value: this.formatLatency(data.responseSimulator?.averageLatency || 0) },
            { label: 'Error Rate', value: this.formatPercentage(data.server?.errors / Math.max(data.server?.totalRequests, 1) || 0) }
        ];
        
        statisticsGrid.innerHTML = stats.map(stat => 
            \`<div class="stat-item">
                <span class="stat-label">\${stat.label}:</span>
                <span class="stat-value">\${stat.value}</span>
            </div>\`
        ).join('');
    }
    
    async loadProviders() {
        try {
            const response = await fetch(this.baseApiUrl + '/stats');
            const data = await response.json();
            
            this.updateProviders(data.providers);
            
        } catch (error) {
            console.error('Error loading providers:', error);
            document.getElementById('providersGrid').innerHTML = 
                '<div class="error">Failed to load providers</div>';
        }
    }
    
    updateProviders(providersData) {
        const providersGrid = document.getElementById('providersGrid');
        
        if (!providersData || !providersData.providerStats) {
            providersGrid.innerHTML = '<div class="loading">No provider data</div>';
            return;
        }
        
        const providers = Object.entries(providersData.providerStats);
        
        if (providers.length === 0) {
            providersGrid.innerHTML = '<div class="loading">No providers configured</div>';
            return;
        }
        
        providersGrid.innerHTML = providers.map(([name, stats]) => 
            \`<div class="grid-item">
                <h4>🤖 \${name.toUpperCase()}</h4>
                <div class="provider-stats">
                    <div class="provider-stat">
                        <span class="provider-stat-value">\${stats.totalRequests || 0}</span>
                        <span class="provider-stat-label">Requests</span>
                    </div>
                    <div class="provider-stat">
                        <span class="provider-stat-value">\${stats.totalResponses || 0}</span>
                        <span class="provider-stat-label">Responses</span>
                    </div>
                    <div class="provider-stat">
                        <span class="provider-stat-value">\${this.formatLatency(stats.averageLatency || 0)}</span>
                        <span class="provider-stat-label">Avg Latency</span>
                    </div>
                    <div class="provider-stat">
                        <span class="provider-stat-value">\${stats.totalErrors || 0}</span>
                        <span class="provider-stat-label">Errors</span>
                    </div>
                </div>
            </div>\`
        ).join('');
    }
    
    async startScenario(scenarioName) {
        try {
            const response = await fetch(\`\${this.baseApiUrl}/scenarios/\${scenarioName}/start\`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.addLogEntry(\`▶️ Started scenario: \${scenarioName}\`);
                this.loadScenarios(); // 刷新场景列表
            } else {
                this.showError(\`Failed to start scenario: \${data.error}\`);
            }
            
        } catch (error) {
            console.error('Error starting scenario:', error);
            this.showError('Failed to start scenario');
        }
    }
    
    async stopScenario(scenarioName) {
        try {
            const response = await fetch(\`\${this.baseApiUrl}/scenarios/\${scenarioName}/stop\`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.addLogEntry(\`⏹️ Stopped scenario: \${scenarioName}\`);
                this.loadScenarios(); // 刷新场景列表
            } else {
                this.showError(\`Failed to stop scenario: \${data.error}\`);
            }
            
        } catch (error) {
            console.error('Error stopping scenario:', error);
            this.showError('Failed to stop scenario');
        }
    }
    
    addLogEntry(message) {
        const activityLog = document.getElementById('activityLog');
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = \`
            <span class="log-time">\${new Date().toLocaleTimeString()}</span>
            <span class="log-message">\${message}</span>
        \`;
        
        activityLog.insertBefore(logEntry, activityLog.firstChild);
        
        // 限制日志条目数量
        const logEntries = activityLog.querySelectorAll('.log-entry');
        if (logEntries.length > 20) {
            activityLog.removeChild(logEntries[logEntries.length - 1]);
        }
    }
    
    showError(message) {
        this.addLogEntry(\`❌ Error: \${message}\`);
    }
    
    formatUptime(ms) {
        if (ms < 1000) return '0s';
        
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return \`\${hours}h \${minutes % 60}m \${seconds % 60}s\`;
        } else if (minutes > 0) {
            return \`\${minutes}m \${seconds % 60}s\`;
        } else {
            return \`\${seconds}s\`;
        }
    }
    
    formatLatency(ms) {
        if (ms < 1) return '0ms';
        return Math.round(ms) + 'ms';
    }
    
    formatPercentage(ratio) {
        return (ratio * 100).toFixed(1) + '%';
    }
}

// 初始化控制面板
const controlPanel = new MockServerControlPanel();

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    controlPanel.stopAutoRefresh();
});`;
    }
    
    /**
     * 获取内容类型
     */
    getContentType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8'
        };
        
        return contentTypes[ext] || 'text/plain';
    }
    
    /**
     * 从路径提取场景名
     */
    extractScenarioName(pathname) {
        const parts = pathname.split('/');
        const scenarioIndex = parts.findIndex(part => part === 'scenarios');
        return scenarioIndex >= 0 && parts[scenarioIndex + 1] ? parts[scenarioIndex + 1] : 'unknown';
    }
    
    /**
     * 广播更新
     */
    broadcastUpdate(data) {
        // 这里可以实现WebSocket广播或其他实时更新机制
        this.emit('update', data);
    }
    
    /**
     * 获取控制面板状态
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            initialized: this.isInitialized,
            path: this.config.path,
            assetsLoaded: this.staticAssets.size
        };
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        this.staticAssets.clear();
        this.removeAllListeners();
        
        console.log('🧹 Web Control Panel cleaned up');
    }
}