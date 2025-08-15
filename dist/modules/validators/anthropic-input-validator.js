"use strict";
/**
 * Anthropic输入验证模块
 *
 * 验证输入是否符合Anthropic API标准格式
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicInputValidator = void 0;
const base_module_impl_1 = require("../base-module-impl");
/**
 * Anthropic输入验证模块
 */
class AnthropicInputValidator extends base_module_impl_1.BaseModule {
    validatorConfig;
    constructor(id, config = {}) {
        super(id, 'Anthropic Input Validator', 'validator', '1.0.0');
        this.validatorConfig = {
            strictMode: true,
            allowExtraFields: false,
            maxMessagesLength: 100,
            maxMessageLength: 100000,
            maxToolsLength: 20,
            ...config
        };
    }
    /**
     * 配置处理
     */
    async onConfigure(config) {
        this.validatorConfig = { ...this.validatorConfig, ...config };
    }
    /**
     * 处理输入验证
     */
    async onProcess(input) {
        if (!input) {
            throw new Error('Input is required');
        }
        // 验证基本结构
        this.validateBasicStructure(input);
        // 验证必需字段
        this.validateRequiredFields(input);
        // 验证消息格式
        if (input.messages) {
            this.validateMessages(input.messages);
        }
        // 验证工具格式
        if (input.tools) {
            this.validateTools(input.tools);
        }
        // 验证参数范围
        this.validateParameterRanges(input);
        // 在严格模式下验证额外字段
        if (this.validatorConfig.strictMode && !this.validatorConfig.allowExtraFields) {
            this.validateNoExtraFields(input);
        }
        return input;
    }
    /**
     * 验证基本结构
     */
    validateBasicStructure(input) {
        if (typeof input !== 'object') {
            throw new Error('Input must be an object');
        }
        if (Array.isArray(input)) {
            throw new Error('Input cannot be an array');
        }
    }
    /**
     * 验证必需字段
     */
    validateRequiredFields(input) {
        const requiredFields = ['model', 'messages'];
        for (const field of requiredFields) {
            if (!(field in input)) {
                throw new Error(`Missing required field: ${field}`);
            }
            if (input[field] === null || input[field] === undefined) {
                throw new Error(`Field ${field} cannot be null or undefined`);
            }
        }
        // 验证model字段
        if (typeof input.model !== 'string' || !input.model.trim()) {
            throw new Error('Model must be a non-empty string');
        }
        // 验证messages字段
        if (!Array.isArray(input.messages) || input.messages.length === 0) {
            throw new Error('Messages must be a non-empty array');
        }
    }
    /**
     * 验证消息格式
     */
    validateMessages(messages) {
        if (messages.length > this.validatorConfig.maxMessagesLength) {
            throw new Error(`Too many messages: ${messages.length} > ${this.validatorConfig.maxMessagesLength}`);
        }
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            if (!message || typeof message !== 'object') {
                throw new Error(`Message at index ${i} must be an object`);
            }
            // 验证role字段
            if (!message.role || typeof message.role !== 'string') {
                throw new Error(`Message at index ${i} must have a valid role`);
            }
            const validRoles = ['user', 'assistant', 'system'];
            if (!validRoles.includes(message.role)) {
                throw new Error(`Message at index ${i} has invalid role: ${message.role}`);
            }
            // 验证content字段
            if (!message.content) {
                throw new Error(`Message at index ${i} must have content`);
            }
            if (typeof message.content === 'string') {
                if (message.content.length > this.validatorConfig.maxMessageLength) {
                    throw new Error(`Message content at index ${i} is too long: ${message.content.length} > ${this.validatorConfig.maxMessageLength}`);
                }
            }
            else if (Array.isArray(message.content)) {
                this.validateMessageContentBlocks(message.content, i);
            }
            else {
                throw new Error(`Message content at index ${i} must be string or array`);
            }
        }
    }
    /**
     * 验证消息内容块
     */
    validateMessageContentBlocks(contentBlocks, messageIndex) {
        for (let i = 0; i < contentBlocks.length; i++) {
            const block = contentBlocks[i];
            if (!block || typeof block !== 'object') {
                throw new Error(`Content block ${i} in message ${messageIndex} must be an object`);
            }
            if (!block.type || typeof block.type !== 'string') {
                throw new Error(`Content block ${i} in message ${messageIndex} must have a type`);
            }
            const validBlockTypes = ['text', 'image', 'tool_use', 'tool_result'];
            if (!validBlockTypes.includes(block.type)) {
                throw new Error(`Content block ${i} in message ${messageIndex} has invalid type: ${block.type}`);
            }
            // 根据类型验证特定字段
            switch (block.type) {
                case 'text':
                    if (!block.text || typeof block.text !== 'string') {
                        throw new Error(`Text block ${i} in message ${messageIndex} must have text field`);
                    }
                    break;
                case 'image':
                    if (!block.source || typeof block.source !== 'object') {
                        throw new Error(`Image block ${i} in message ${messageIndex} must have source field`);
                    }
                    break;
                case 'tool_use':
                    if (!block.id || typeof block.id !== 'string') {
                        throw new Error(`Tool use block ${i} in message ${messageIndex} must have id field`);
                    }
                    if (!block.name || typeof block.name !== 'string') {
                        throw new Error(`Tool use block ${i} in message ${messageIndex} must have name field`);
                    }
                    break;
                case 'tool_result':
                    if (!block.tool_use_id || typeof block.tool_use_id !== 'string') {
                        throw new Error(`Tool result block ${i} in message ${messageIndex} must have tool_use_id field`);
                    }
                    break;
            }
        }
    }
    /**
     * 验证工具格式
     */
    validateTools(tools) {
        if (tools.length > this.validatorConfig.maxToolsLength) {
            throw new Error(`Too many tools: ${tools.length} > ${this.validatorConfig.maxToolsLength}`);
        }
        for (let i = 0; i < tools.length; i++) {
            const tool = tools[i];
            if (!tool || typeof tool !== 'object') {
                throw new Error(`Tool at index ${i} must be an object`);
            }
            // 验证name字段
            if (!tool.name || typeof tool.name !== 'string') {
                throw new Error(`Tool at index ${i} must have a name`);
            }
            // 验证description字段
            if (tool.description && typeof tool.description !== 'string') {
                throw new Error(`Tool at index ${i} description must be a string`);
            }
            // 验证input_schema字段
            if (!tool.input_schema || typeof tool.input_schema !== 'object') {
                throw new Error(`Tool at index ${i} must have an input_schema`);
            }
            // 验证input_schema类型
            if (tool.input_schema.type !== 'object') {
                throw new Error(`Tool at index ${i} input_schema type must be 'object'`);
            }
        }
    }
    /**
     * 验证参数范围
     */
    validateParameterRanges(input) {
        // 验证max_tokens
        if (input.max_tokens !== undefined) {
            if (!Number.isInteger(input.max_tokens) || input.max_tokens <= 0) {
                throw new Error('max_tokens must be a positive integer');
            }
            if (input.max_tokens > 100000) {
                throw new Error('max_tokens cannot exceed 100000');
            }
        }
        // 验证temperature
        if (input.temperature !== undefined) {
            if (typeof input.temperature !== 'number') {
                throw new Error('temperature must be a number');
            }
            if (input.temperature < 0 || input.temperature > 1) {
                throw new Error('temperature must be between 0 and 1');
            }
        }
        // 验证top_p
        if (input.top_p !== undefined) {
            if (typeof input.top_p !== 'number') {
                throw new Error('top_p must be a number');
            }
            if (input.top_p < 0 || input.top_p > 1) {
                throw new Error('top_p must be between 0 and 1');
            }
        }
        // 验证stop sequences
        if (input.stop !== undefined) {
            if (typeof input.stop === 'string') {
                // 单个停止序列
                if (input.stop.length === 0) {
                    throw new Error('stop sequence cannot be empty');
                }
            }
            else if (Array.isArray(input.stop)) {
                // 多个停止序列
                if (input.stop.length === 0) {
                    throw new Error('stop sequences array cannot be empty');
                }
                for (let i = 0; i < input.stop.length; i++) {
                    if (typeof input.stop[i] !== 'string' || input.stop[i].length === 0) {
                        throw new Error(`stop sequence at index ${i} must be a non-empty string`);
                    }
                }
                if (input.stop.length > 4) {
                    throw new Error('cannot have more than 4 stop sequences');
                }
            }
            else {
                throw new Error('stop must be a string or array of strings');
            }
        }
    }
    /**
     * 验证无额外字段
     */
    validateNoExtraFields(input) {
        const allowedFields = [
            'model', 'messages', 'max_tokens', 'temperature', 'top_p', 'top_k',
            'stop', 'stream', 'system', 'tools', 'tool_choice', 'metadata'
        ];
        for (const field in input) {
            if (!allowedFields.includes(field)) {
                throw new Error(`Unexpected field in strict mode: ${field}`);
            }
        }
    }
}
exports.AnthropicInputValidator = AnthropicInputValidator;
//# sourceMappingURL=anthropic-input-validator.js.map