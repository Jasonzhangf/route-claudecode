/**
 * Test: Mock Server Basic Functionality
 * 测试Mock Server的基本功能
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import http from 'http';
import { MockServer } from '../mock-server/data-replay-system/index.js';
import { MockServerConfig } from '../mock-server/data-replay-system/config/mock-server-config.js';

export class MockServerBasicFunctionalityTests {
    constructor() {
        this.testResults = [];
        this.mockServer = null;
    }
    
    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('🧪 Starting Mock Server Basic Functionality Tests...');
        
        try {
            // Test 1: Configuration initialization
            await this.testConfigurationInitialization();
            
            // Test 2: Mock Server creation
            await this.testMockServerCreation();
            
            // Test 3: Server startup and shutdown
            await this.testServerStartupShutdown();
            
            // Test 4: Basic request handling
            await this.testBasicRequestHandling();
            
            // Test 5: Scenario management
            await this.testScenarioManagement();
            
            // Test 6: Data replay infrastructure
            await this.testDataReplayInfrastructure();
            
            // Test 7: Provider simulation
            await this.testProviderSimulation();
            
            // Test 8: Response simulation
            await this.testResponseSimulation();
            
            // Test 9: Web Control Panel
            await this.testWebControlPanel();
            
            console.log('\\n📊 Mock Server Basic Functionality Test Results:');
            this.testResults.forEach((result, index) => {
                const status = result.passed ? '✅' : '❌';
                console.log(`   ${status} Test ${index + 1}: ${result.name} (${result.duration}ms)`);
                if (!result.passed) {
                    console.log(`      Error: ${result.error}`);
                }
            });
            
            const passedTests = this.testResults.filter(r => r.passed).length;
            const totalTests = this.testResults.length;
            
            console.log(`\\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
            
            if (passedTests === totalTests) {
                console.log('✅ All Mock Server basic functionality tests passed!');
                return true;
            } else {
                console.log('❌ Some Mock Server tests failed');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Mock Server testing failed:', error.message);
            return false;
        } finally {
            // 清理资源
            if (this.mockServer) {
                if (this.mockServer.isRunning) {
                    await this.mockServer.stop();
                }
                await this.mockServer.cleanup();
            }
        }
    }
    
    /**
     * Test 1: Configuration initialization
     */
    async testConfigurationInitialization() {
        const startTime = Date.now();
        
        try {
            console.log('🔧 Testing configuration initialization...');
            
            // 创建配置实例
            const config = new MockServerConfig({
                server: { port: 3459, host: 'localhost' },
                providers: { enabled: ['anthropic', 'openai'] }
            });
            
            // 验证配置合并
            const serverConfig = config.getServerConfig();
            if (serverConfig.port !== 3459) {
                throw new Error('Configuration merge failed');
            }
            
            // 验证Provider配置
            const providerConfig = config.getProviderConfig();
            if (!providerConfig.enabled.includes('anthropic')) {
                throw new Error('Provider configuration failed');
            }
            
            // 验证配置验证
            config.validateConfig();
            
            console.log('✅ Configuration initialization test passed');
            
            this.testResults.push({
                name: 'Configuration Initialization',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Configuration initialization test failed:', error.message);
            
            this.testResults.push({
                name: 'Configuration Initialization',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        }
    }
    
    /**
     * Test 2: Mock Server creation
     */
    async testMockServerCreation() {
        const startTime = Date.now();
        
        try {
            console.log('🏗️  Testing Mock Server creation...');
            
            // 创建Mock Server实例
            this.mockServer = new MockServer({
                server: { port: 3459, host: 'localhost' },
                dataReplay: { cacheEnabled: true },
                scenarios: { maxActiveScenarios: 3 }
            });
            
            // 验证组件初始化
            if (!this.mockServer.core) {
                throw new Error('Mock Server Core not initialized');
            }
            
            if (!this.mockServer.dataReplay) {
                throw new Error('Data Replay Infrastructure not initialized');
            }
            
            if (!this.mockServer.scenarioManager) {
                throw new Error('Scenario Manager not initialized');
            }
            
            if (!this.mockServer.responseSimulator) {
                throw new Error('Response Simulator not initialized');
            }
            
            if (!this.mockServer.providerSimulation) {
                throw new Error('Provider Simulation not initialized');
            }
            
            // 验证初始状态
            const status = this.mockServer.getStatus();
            if (status.isRunning) {
                throw new Error('Mock Server should not be running initially');
            }
            
            console.log('✅ Mock Server creation test passed');
            
            this.testResults.push({
                name: 'Mock Server Creation',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Mock Server creation test failed:', error.message);
            
            this.testResults.push({
                name: 'Mock Server Creation',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        }
    }
    
    /**
     * Test 3: Server startup and shutdown
     */
    async testServerStartupShutdown() {
        const startTime = Date.now();
        
        try {
            console.log('🚀 Testing server startup and shutdown...');
            
            if (!this.mockServer) {
                throw new Error('Mock Server not available for testing');
            }
            
            // 测试启动
            const startResult = await this.mockServer.start({ port: 3459 });
            
            if (!startResult.address) {
                throw new Error('Server start did not return address');
            }
            
            // 验证运行状态
            const runningStatus = this.mockServer.getStatus();
            if (!runningStatus.isRunning) {
                throw new Error('Server status should be running');
            }
            
            // 简单的健康检查
            await this.performHealthCheck();
            
            // 测试停止
            await this.mockServer.stop();
            
            // 验证停止状态
            const stoppedStatus = this.mockServer.getStatus();
            if (stoppedStatus.isRunning) {
                throw new Error('Server should be stopped');
            }
            
            console.log('✅ Server startup and shutdown test passed');
            
            this.testResults.push({
                name: 'Server Startup and Shutdown',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Server startup and shutdown test failed:', error.message);
            
            this.testResults.push({
                name: 'Server Startup and Shutdown',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        }
    }
    
    /**
     * Test 4: Basic request handling
     */
    async testBasicRequestHandling() {
        const startTime = Date.now();
        let testServer = null;
        
        try {
            console.log('📡 Testing basic request handling...');
            
            // 创建专用的测试服务器
            testServer = new MockServer({
                server: { port: 3460, host: 'localhost' },
                dataReplay: { cacheEnabled: true }
            });
            
            // 启动服务器
            await testServer.start({ port: 3460 });
            
            // 测试健康检查端点
            const healthResponse = await this.makeRequest('GET', '/health', null, 3460);
            if (healthResponse.status !== 'healthy') {
                throw new Error('Health check failed');
            }
            
            // 测试状态端点
            const statusResponse = await this.makeRequest('GET', '/status', null, 3460);
            if (!statusResponse.server) {
                throw new Error('Status endpoint failed');
            }
            
            // 测试Provider端点
            const providerResponse = await this.makeRequest('POST', '/v1/messages', {
                messages: [{ role: 'user', content: 'Test message' }]
            }, 3460);
            
            if (!providerResponse.id) {
                throw new Error('Provider endpoint failed');
            }
            
            await testServer.stop();
            
            console.log('✅ Basic request handling test passed');
            
            this.testResults.push({
                name: 'Basic Request Handling',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Basic request handling test failed:', error.message);
            
            this.testResults.push({
                name: 'Basic Request Handling',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        } finally {
            // 清理测试服务器
            if (testServer && testServer.isRunning) {
                await testServer.stop();
            }
        }
    }
    
    /**
     * Test 5: Scenario management
     */
    async testScenarioManagement() {
        const startTime = Date.now();
        
        try {
            console.log('🎬 Testing scenario management...');
            
            if (!this.mockServer) {
                throw new Error('Mock Server not available for testing');
            }
            
            // 加载可用场景
            await this.mockServer.scenarioManager.loadAvailableScenarios();
            
            // 获取场景列表
            const scenarios = this.mockServer.scenarioManager.getAvailableScenarios();
            if (scenarios.length === 0) {
                throw new Error('No scenarios loaded');
            }
            
            // 创建自定义场景
            const testScenarioName = `test-scenario-${Date.now()}`;
            const customScenario = await this.mockServer.scenarioManager.createScenario({
                name: testScenarioName,
                description: 'Test scenario for unit testing',
                dataFilters: { provider: 'test' },
                replayOptions: { replaySpeed: 2.0 }
            });
            
            if (customScenario.name !== testScenarioName) {
                throw new Error('Custom scenario creation failed');
            }
            
            // 验证场景已添加
            const updatedScenarios = this.mockServer.scenarioManager.getAvailableScenarios();
            const testScenario = updatedScenarios.find(s => s.name === testScenarioName);
            if (!testScenario) {
                throw new Error('Created scenario not found in list');
            }
            
            console.log('✅ Scenario management test passed');
            
            this.testResults.push({
                name: 'Scenario Management',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Scenario management test failed:', error.message);
            
            this.testResults.push({
                name: 'Scenario Management',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        }
    }
    
    /**
     * Test 6: Data replay infrastructure
     */
    async testDataReplayInfrastructure() {
        const startTime = Date.now();
        
        try {
            console.log('📊 Testing data replay infrastructure...');
            
            if (!this.mockServer) {
                throw new Error('Mock Server not available for testing');
            }
            
            // 初始化数据重放基础设施
            await this.mockServer.dataReplay.initialize();
            
            // 测试数据索引
            const stats = this.mockServer.dataReplay.getStats();
            if (typeof stats.cacheSize !== 'number') {
                throw new Error('Data replay stats invalid');
            }
            
            // 测试数据服务（模拟请求）
            try {
                await this.mockServer.dataReplay.serveDataFromDatabase({
                    sessionId: 'test-session',
                    layer: 'test-layer',
                    operation: 'test-operation'
                });
            } catch (error) {
                // 预期会失败，因为没有实际数据
                if (!error.message.includes('No data found')) {
                    throw error;
                }
            }
            
            console.log('✅ Data replay infrastructure test passed');
            
            this.testResults.push({
                name: 'Data Replay Infrastructure',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Data replay infrastructure test failed:', error.message);
            
            this.testResults.push({
                name: 'Data Replay Infrastructure',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        }
    }
    
    /**
     * Test 7: Provider simulation
     */
    async testProviderSimulation() {
        const startTime = Date.now();
        
        try {
            console.log('🤖 Testing provider simulation...');
            
            if (!this.mockServer) {
                throw new Error('Mock Server not available for testing');
            }
            
            // 初始化Provider模拟
            await this.mockServer.providerSimulation.initialize();
            
            // 验证支持的Provider
            const supportedProviders = this.mockServer.providerSimulation.getSupportedProviders();
            if (!supportedProviders.includes('anthropic')) {
                throw new Error('Anthropic provider not supported');
            }
            
            // 测试Provider响应模拟
            const mockRequest = {
                messages: [{ role: 'user', content: 'Test message' }]
            };
            
            const response = await this.mockServer.providerSimulation.simulateProviderResponse(
                'anthropic', 
                mockRequest
            );
            
            if (!response.id) {
                throw new Error('Provider simulation did not return valid response');
            }
            
            // 获取模拟统计
            const simStats = this.mockServer.providerSimulation.getSimulationStats();
            if (!simStats.totalProviders) {
                throw new Error('Provider simulation stats invalid');
            }
            
            console.log('✅ Provider simulation test passed');
            
            this.testResults.push({
                name: 'Provider Simulation',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Provider simulation test failed:', error.message);
            
            this.testResults.push({
                name: 'Provider Simulation',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        }
    }
    
    /**
     * Test 8: Response simulation
     */
    async testResponseSimulation() {
        const startTime = Date.now();
        
        try {
            console.log('🎭 Testing response simulation...');
            
            if (!this.mockServer) {
                throw new Error('Mock Server not available for testing');
            }
            
            // 配置响应模拟器
            const testScenario = {
                name: 'test-response-scenario',
                config: {
                    replayOptions: {
                        preserveTiming: false,
                        replaySpeed: 5.0,
                        responseDelay: { min: 10, max: 50 }
                    }
                }
            };
            
            this.mockServer.responseSimulator.configureForScenario(testScenario);
            
            // 测试响应模拟
            const mockRequest = {
                messages: [{ role: 'user', content: 'Test response simulation' }]
            };
            
            const mockOriginalData = {
                data: {
                    id: 'original-response',
                    content: 'Original response content'
                },
                metadata: {
                    processingTime: 1000
                }
            };
            
            const simulatedResponse = await this.mockServer.responseSimulator.simulateResponse(
                mockRequest,
                mockOriginalData
            );
            
            if (!simulatedResponse.mockMetadata) {
                throw new Error('Response simulation did not add metadata');
            }
            
            // 获取模拟统计
            const responseStats = this.mockServer.responseSimulator.getStats();
            if (responseStats.totalResponses !== 1) {
                throw new Error('Response simulation stats incorrect');
            }
            
            console.log('✅ Response simulation test passed');
            
            this.testResults.push({
                name: 'Response Simulation',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Response simulation test failed:', error.message);
            
            this.testResults.push({
                name: 'Response Simulation',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        }
    }
    
    /**
     * Test 9: Web Control Panel
     */
    async testWebControlPanel() {
        const startTime = Date.now();
        let testServer = null;
        
        try {
            console.log('🎛️ Testing web control panel...');
            
            // 创建专用的测试服务器
            testServer = new MockServer({
                server: { port: 3461, host: 'localhost' },
                webControlPanel: { enabled: true }
            });
            
            // 启动服务器
            await testServer.start({ port: 3461 });
            
            // 测试控制面板主页
            const dashboardResponse = await this.makeRequest('GET', '/management', null, 3461);
            if (!dashboardResponse.includes('Mock Server Control Panel')) {
                throw new Error('Control panel dashboard not accessible');
            }
            
            // 测试API状态端点
            const statusResponse = await this.makeRequest('GET', '/management/api/status', null, 3461);
            if (!statusResponse.server) {
                throw new Error('Control panel API status endpoint failed');
            }
            
            // 测试场景API端点
            const scenariosResponse = await this.makeRequest('GET', '/management/api/scenarios', null, 3461);
            if (typeof scenariosResponse.total !== 'number') {
                throw new Error('Control panel scenarios API failed');
            }
            
            // 测试统计API端点
            const statsResponse = await this.makeRequest('GET', '/management/api/stats', null, 3461);
            if (!statsResponse.server) {
                throw new Error('Control panel stats API failed');
            }
            
            // 验证控制面板状态
            const webPanelStatus = testServer.webControlPanel.getStatus();
            if (!webPanelStatus.enabled) {
                throw new Error('Web control panel should be enabled');
            }
            
            if (!webPanelStatus.initialized) {
                throw new Error('Web control panel should be initialized');
            }
            
            await testServer.stop();
            
            console.log('✅ Web control panel test passed');
            
            this.testResults.push({
                name: 'Web Control Panel',
                passed: true,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error('❌ Web control panel test failed:', error.message);
            
            this.testResults.push({
                name: 'Web Control Panel',
                passed: false,
                duration: Date.now() - startTime,
                error: error.message
            });
        } finally {
            // 清理测试服务器
            if (testServer && testServer.isRunning) {
                await testServer.stop();
            }
        }
    }
    
    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        return new Promise((resolve, reject) => {
            
            const req = http.request({
                hostname: 'localhost',
                port: 3459,
                path: '/health',
                method: 'GET'
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.status === 'healthy') {
                            resolve(response);
                        } else {
                            reject(new Error('Health check returned unhealthy status'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.end();
        });
    }
    
    /**
     * 发送HTTP请求
     */
    async makeRequest(method, path, body = null, port = 3459) {
        return new Promise((resolve, reject) => {
            
            const options = {
                hostname: 'localhost',
                port: port,
                path,
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        resolve(data);
                    }
                });
            });
            
            req.on('error', reject);
            
            if (body) {
                req.write(JSON.stringify(body));
            }
            
            req.end();
        });
    }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new MockServerBasicFunctionalityTests();
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
}