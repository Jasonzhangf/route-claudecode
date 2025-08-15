"use strict";
/**
 * 标准工具数据结构接口
 *
 * 定义工具调用和工具定义的标准格式
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolBuilder = void 0;
/**
 * 工具构建器
 */
class ToolBuilder {
    tool = {};
    constructor() {
        this.tool = {
            type: 'function',
            function: {
                name: '',
                description: '',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        };
    }
    /**
     * 设置函数名称
     */
    setName(name) {
        if (!this.tool.function) {
            this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
        }
        this.tool.function.name = name;
        return this;
    }
    /**
     * 设置函数描述
     */
    setDescription(description) {
        if (!this.tool.function) {
            this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
        }
        this.tool.function.description = description;
        return this;
    }
    /**
     * 添加参数
     */
    addParameter(name, schema, required = false) {
        if (!this.tool.function) {
            this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
        }
        if (!this.tool.function.parameters.properties) {
            this.tool.function.parameters.properties = {};
        }
        this.tool.function.parameters.properties[name] = schema;
        if (required) {
            if (!this.tool.function.parameters.required) {
                this.tool.function.parameters.required = [];
            }
            this.tool.function.parameters.required.push(name);
        }
        return this;
    }
    /**
     * 设置参数模式
     */
    setParameterSchema(schema) {
        if (!this.tool.function) {
            this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
        }
        this.tool.function.parameters = schema;
        return this;
    }
    /**
     * 添加示例
     */
    addExample(example) {
        if (!this.tool.function) {
            this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
        }
        if (!this.tool.function.examples) {
            this.tool.function.examples = [];
        }
        this.tool.function.examples.push(example);
        return this;
    }
    /**
     * 设置元数据
     */
    setMetadata(metadata) {
        this.tool.metadata = metadata;
        return this;
    }
    /**
     * 设置风险级别
     */
    setRiskLevel(level) {
        if (!this.tool.metadata) {
            this.tool.metadata = {};
        }
        this.tool.metadata.riskLevel = level;
        return this;
    }
    /**
     * 添加标签
     */
    addTag(tag) {
        if (!this.tool.metadata) {
            this.tool.metadata = {};
        }
        if (!this.tool.metadata.tags) {
            this.tool.metadata.tags = [];
        }
        this.tool.metadata.tags.push(tag);
        return this;
    }
    /**
     * 构建工具
     */
    build() {
        if (!this.tool.function?.name || !this.tool.function?.description) {
            throw new Error('Missing required fields in Tool');
        }
        return this.tool;
    }
    /**
     * 从OpenAI格式创建
     */
    static fromOpenAI(openaiTool) {
        const builder = new ToolBuilder();
        if (openaiTool.function) {
            builder
                .setName(openaiTool.function.name)
                .setDescription(openaiTool.function.description)
                .setParameterSchema(openaiTool.function.parameters);
        }
        return builder;
    }
    /**
     * 从Anthropic格式创建
     */
    static fromAnthropic(anthropicTool) {
        const builder = new ToolBuilder();
        builder
            .setName(anthropicTool.name)
            .setDescription(anthropicTool.description)
            .setParameterSchema(anthropicTool.input_schema);
        return builder;
    }
}
exports.ToolBuilder = ToolBuilder;
//# sourceMappingURL=tool.js.map