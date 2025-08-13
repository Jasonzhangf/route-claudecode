#!/usr/bin/env node
/**
 * Claude Code Router V3.0 纯净启动脚本
 * 完全独立的V3原生启动系统，无v2.7依赖
 *
 * Project owner: Jason Zhang
 */
import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
class V3PureServer {
    constructor(config) {
        this.config = config;
        this.startTime = Date.now();
        this.fastify = Fastify({
            logger: config.debug.enabled ? { level: config.debug.logLevel || 'info' } : false
        });
        this.setupRoutes();
    }
    setupRoutes() {
        // Health check endpoint
        this.fastify.get('/health', async (request, reply) => {
            const uptime = Date.now() - this.startTime;
            return {
                status: 'healthy',
                architecture: 'v3.0',
                uptime: `${Math.floor(uptime / 1000)}s`,
                server: this.config.name,
                timestamp: new Date().toISOString(),
                layers: Object.keys(this.config.layers).length,
                providers: Object.keys(this.config.providers).length,
                categories: Object.keys(this.config.routing.categories).length
            };
        });
        // Status endpoint
        this.fastify.get('/status', async (request, reply) => {
            return {
                server: 'claude-code-router-v3',
                version: '3.0.0',
                architecture: this.config.server.architecture,
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
                config: {
                    name: this.config.name,
                    port: this.config.server.port,
                    host: this.config.server.host,
                    layers: Object.keys(this.config.layers),
                    providers: Object.keys(this.config.providers),
                    categories: Object.keys(this.config.routing.categories)
                },
                debug: this.config.debug
            };
        });
        // V3 API endpoint (mockup for testing)
        this.fastify.post('/v1/messages', async (request, reply) => {
            const body = request.body;
            return {
                id: `msg-v3-${Date.now()}`,
                type: 'message',
                role: 'assistant',
                content: [{
                        type: 'text',
                        text: `V3 Pure Server Response: Received request for model ${body.model || 'unknown'}. V3 six-layer architecture is active with ${Object.keys(this.config.providers).length} providers and ${Object.keys(this.config.routing.categories).length} routing categories.`
                    }],
                model: body.model || 'v3-default',
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: {
                    input_tokens: 10,
                    output_tokens: 25
                }
            };
        });
        // V3 Info endpoint
        this.fastify.get('/v3/info', async (request, reply) => {
            return {
                architecture: 'v3.0-six-layer',
                layers: this.config.layers,
                providers: Object.keys(this.config.providers).map(key => ({
                    id: key,
                    type: this.config.providers[key].type,
                    enabled: this.config.providers[key].enabled !== false
                })),
                routing: {
                    strategy: this.config.routing.strategy,
                    categories: Object.keys(this.config.routing.categories)
                },
                governance: {
                    zeroHardcoding: true,
                    zeroFallback: true,
                    testingRequired: true
                }
            };
        });
    }
    async start() {
        try {
            const address = await this.fastify.listen({
                port: this.config.server.port,
                host: this.config.server.host
            });
            console.log('🚀 Claude Code Router V3.0 Pure Server Started');
            console.log('====================================');
            console.log(`📋 Config: ${this.config.name}`);
            console.log(`🏗️  Architecture: ${this.config.server.architecture}`);
            console.log(`🌐 Address: ${address}`);
            console.log(`🔧 Layers: ${Object.keys(this.config.layers).length}`);
            console.log(`📊 Providers: ${Object.keys(this.config.providers).length}`);
            console.log(`🎯 Categories: ${Object.keys(this.config.routing.categories).length}`);
            console.log('');
            console.log('📋 Available Endpoints:');
            console.log('   GET  /health     - Health check');
            console.log('   GET  /status     - Server status');
            console.log('   GET  /v3/info    - V3 architecture info');
            console.log('   POST /v1/messages - V3 API (mockup)');
            console.log('');
            console.log('🎉 V3 Pure Server Ready');
            console.log('Press Ctrl+C to stop');
        }
        catch (error) {
            console.error('❌ Failed to start V3 Pure Server:', error);
            throw error;
        }
    }
    async stop() {
        await this.fastify.close();
        console.log('🛑 V3 Pure Server stopped');
    }
}
// Main execution
async function main() {
    const configPath = process.argv[2];
    if (!configPath) {
        console.error('❌ Config path required');
        console.log('Usage: node start-v3-pure.js <config-path>');
        process.exit(1);
    }
    if (!fs.existsSync(configPath)) {
        console.error(`❌ Config file not found: ${configPath}`);
        process.exit(1);
    }
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        console.log('🔧 Loading V3 Configuration...');
        console.log(`📄 Config: ${path.basename(configPath)}`);
        console.log(`🏗️  Architecture: ${config.server.architecture}`);
        console.log(`🌐 Port: ${config.server.port}`);
        console.log('');
        const server = new V3PureServer(config);
        // Graceful shutdown handling
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down V3 Pure Server...');
            await server.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('\n🛑 Shutting down V3 Pure Server...');
            await server.stop();
            process.exit(0);
        });
        await server.start();
    }
    catch (error) {
        console.error('❌ Failed to start V3 Pure Server:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
export { V3PureServer };
