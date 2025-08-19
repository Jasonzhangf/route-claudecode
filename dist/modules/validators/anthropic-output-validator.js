"use strict";
/**
 * Anthropic输出验证模块
 *
 * 验证输出是否符合Anthropic API响应格式
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicOutputValidator = void 0;
const module_implementation_interface_1 = require("../../interfaces/core/module-implementation-interface");
const events_1 = require("events");
/**
 * Anthropic输出验证模块
 */
class AnthropicOutputValidator extends events_1.EventEmitter {
    getId() {
        return this.id;
    }
    getName() {
        return this.name;
    }
    getType() {
        return this.type;
    }
    getVersion() {
        return this.version;
    }
    getStatus() {
        return { id: this.id, name: this.name, type: this.type, status: this.status, health: 'healthy' };
    }
    getMetrics() {
        return { ...this.metrics };
    }
    async configure(config) { }
    async start() {
        this.status = 'running';
    }
    async stop() {
        this.status = 'stopped';
    }
    async reset() { }
    async cleanup() { }
    async healthCheck() {
        return { healthy: true, details: {} };
    }
    async process(input) {
        return this.onProcess(input);
    }
    constructor(id = 'anthropic-output-validator', config = {}) {
        super();
        this.id = 'anthropic-output-validator';
        this.name = 'Anthropic Output Validator';
        this.type = module_implementation_interface_1.ModuleType.VALIDATOR;
        this.version = '1.0.0';
        this.status = 'stopped';
        this.metrics = {
            requestsProcessed: 0,
            averageProcessingTime: 0,
            errorRate: 0,
            memoryUsage: 0,
            cpuUsage: 0,
        };
        this.validatorConfig = {
            strictMode: true,
            validateTokens: true,
            validateTimestamp: false,
            allowEmptyContent: false,
            ...config,
        };
    }
    /**
     * 配置处理
     */
    async onConfigure(config) {
        this.validatorConfig = { ...this.validatorConfig, ...config };
    }
    /**
     * 处理输出验证
     */
    async onProcess(input) {
        if (!input) {
            throw new Error('Output is required');
        }
        // 验证基本结构
        this.validateBasicStructure(input);
        // 验证必需字段
        this.validateRequiredFields(input);
        // 验证响应内容
        if (input.content) {
            this.validateContent(input.content);
        }
        // 验证使用统计
        if (input.usage) {
            this.validateUsage(input.usage);
        }
        // 验证停止原因
        if (input.stop_reason) {
            this.validateStopReason(input.stop_reason);
        }
        // 验证时间戳
        if (this.validatorConfig.validateTimestamp && input.created_at) {
            this.validateTimestamp(input.created_at);
        }
        // 在严格模式下验证额外字段
        if (this.validatorConfig.strictMode) {
            this.validateNoExtraFields(input);
        }
        return input;
    }
    /**
     * 验证基本结构
     */
    validateBasicStructure(input) {
        if (typeof input !== 'object') {
            throw new Error('Output must be an object');
        }
        if (Array.isArray(input)) {
            throw new Error('Output cannot be an array');
        }
    }
    /**
     * 验证必需字段
     */
    validateRequiredFields(input) {
        const requiredFields = ['id', 'type', 'role', 'content', 'model', 'stop_reason', 'usage'];
        for (const field of requiredFields) {
            if (!(field in input)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        // 验证id字段
        if (typeof input.id !== 'string' || !input.id.trim()) {
            throw new Error('id must be a non-empty string');
        }
        // 验证type字段
        if (input.type !== 'message') {
            throw new Error('type must be "message"');
        }
        // 验证role字段
        if (input.role !== 'assistant') {
            throw new Error('role must be "assistant"');
        }
        // 验证model字段
        if (typeof input.model !== 'string' || !input.model.trim()) {
            throw new Error('model must be a non-empty string');
        }
    }
    /**
     * 验证响应内容
     */
    validateContent(content) {
        if (!Array.isArray(content)) {
            throw new Error('content must be an array');
        }
        if (content.length === 0 && !this.validatorConfig.allowEmptyContent) {
            throw new Error('content cannot be empty');
        }
        for (let i = 0; i < content.length; i++) {
            const block = content[i];
            if (!block || typeof block !== 'object') {
                throw new Error(`Content block ${i} must be an object`);
            }
            if (!block.type || typeof block.type !== 'string') {
                throw new Error(`Content block ${i} must have a type`);
            }
            const validBlockTypes = ['text', 'tool_use'];
            if (!validBlockTypes.includes(block.type)) {
                throw new Error(`Content block ${i} has invalid type: ${block.type}`);
            }
            switch (block.type) {
                case 'text':
                    this.validateTextBlock(block, i);
                    break;
                case 'tool_use':
                    this.validateToolUseBlock(block, i);
                    break;
            }
        }
    }
    /**
     * 验证文本块
     */
    validateTextBlock(block, index) {
        if (!block.text || typeof block.text !== 'string') {
            throw new Error(`Text block ${index} must have a text field`);
        }
        if (block.text.trim().length === 0 && !this.validatorConfig.allowEmptyContent) {
            throw new Error(`Text block ${index} cannot be empty`);
        }
    }
    /**
     * 验证工具使用块
     */
    validateToolUseBlock(block, index) {
        if (!block.id || typeof block.id !== 'string') {
            throw new Error(`Tool use block ${index} must have an id field`);
        }
        if (!block.name || typeof block.name !== 'string') {
            throw new Error(`Tool use block ${index} must have a name field`);
        }
        if (block.input !== undefined && typeof block.input !== 'object') {
            throw new Error(`Tool use block ${index} input must be an object`);
        }
    }
    /**
     * 验证使用统计
     */
    validateUsage(usage) {
        if (typeof usage !== 'object') {
            throw new Error('usage must be an object');
        }
        const requiredFields = ['input_tokens', 'output_tokens', 'total_tokens'];
        for (const field of requiredFields) {
            if (!(field in usage)) {
                throw new Error(`Missing required usage field: ${field}`);
            }
            if (!Number.isInteger(usage[field]) || usage[field] < 0) {
                throw new Error(`usage.${field} must be a non-negative integer`);
            }
        }
        // 验证total_tokens的一致性
        const expectedTotal = usage.input_tokens + usage.output_tokens;
        if (usage.total_tokens !== expectedTotal) {
            throw new Error(`usage.total_tokens (${usage.total_tokens}) does not match sum of input_tokens (${usage.input_tokens}) and output_tokens (${usage.output_tokens})`);
        }
        // 验证缓存相关tokens
        if (usage.cache_creation_input_tokens !== undefined) {
            if (!Number.isInteger(usage.cache_creation_input_tokens) || usage.cache_creation_input_tokens < 0) {
                throw new Error('usage.cache_creation_input_tokens must be a non-negative integer');
            }
        }
        if (usage.cache_read_input_tokens !== undefined) {
            if (!Number.isInteger(usage.cache_read_input_tokens) || usage.cache_read_input_tokens < 0) {
                throw new Error('usage.cache_read_input_tokens must be a non-negative integer');
            }
        }
    }
    /**
     * 验证停止原因
     */
    validateStopReason(stopReason) {
        if (typeof stopReason !== 'string') {
            throw new Error('stop_reason must be a string');
        }
        const validStopReasons = ['end_turn', 'max_tokens', 'stop_sequence', 'tool_use', 'content_filter'];
        if (!validStopReasons.includes(stopReason)) {
            throw new Error(`Invalid stop_reason: ${stopReason}. Must be one of: ${validStopReasons.join(', ')}`);
        }
    }
    /**
     * 验证时间戳
     */
    validateTimestamp(timestamp) {
        if (typeof timestamp !== 'string') {
            throw new Error('created_at must be a string');
        }
        // 验证ISO 8601格式
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        if (!isoDateRegex.test(timestamp)) {
            throw new Error('created_at must be in ISO 8601 format');
        }
        // 验证时间戳是否有效
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            throw new Error('created_at must be a valid timestamp');
        }
        // 验证时间戳不能是未来时间
        if (date.getTime() > Date.now()) {
            throw new Error('created_at cannot be in the future');
        }
    }
    /**
     * 验证无额外字段
     */
    validateNoExtraFields(input) {
        const allowedFields = [
            'id',
            'type',
            'role',
            'content',
            'model',
            'stop_reason',
            'usage',
            'created_at',
            'system_fingerprint',
        ];
        for (const field in input) {
            if (!allowedFields.includes(field)) {
                throw new Error(`Unexpected field in strict mode: ${field}`);
            }
        }
    }
}
exports.AnthropicOutputValidator = AnthropicOutputValidator;
//# sourceMappingURL=anthropic-output-validator.js.map