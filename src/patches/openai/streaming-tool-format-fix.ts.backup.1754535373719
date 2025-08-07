/**
 * OpenAI 流式工具调用格式修复补丁
 * 处理流式响应中各种工具调用格式的兼容性问题
 */

import { StreamingPatch, PatchContext, PatchResult, Provider } from '../types';

export class OpenAIStreamingToolFormatFixPatch implements StreamingPatch {
  name = 'openai-streaming-tool-format-fix';
  description = 'Fix streaming tool call format compatibility issues';
  type = 'streaming' as const;
  priority = 10;
  
  condition = {
    provider: 'openai' as Provider,
    model: (model: string) => {
      // 支持所有可能返回非标准工具格式的模型
      return model.includes('qwen') ||
             model.includes('glm') ||
             model.includes('zhipu') ||
             model.includes('deepseek') ||
             model.includes('gemini') ||
             model.includes('claude');
    },
    enabled: () => process.env.RCC_PATCHES_OPENAI_STREAMING_TOOL_FIX !== 'false'
  };

  shouldApply(context: PatchContext, data: any): boolean {
    // 检查是否是工具调用参数的流式数据
    if (typeof data !== 'string') {
      return false;
    }

    // 检查是否包含可能的工具调用格式问题
    return this.hasToolFormatIssues(data);
  }

  async apply(context: PatchContext, data: string): Promise<PatchResult<string>> {
    const startTime = Date.now();
    
    try {
      const fixedData = this.fixStreamingToolFormat(data, context);
      
      return {
        success: true,
        data: fixedData,
        applied: fixedData !== data,
        patchName: this.name,
        duration: Date.now() - startTime,
        metadata: {
          originalLength: data.length,
          fixedLength: fixedData.length,
          hasChanges: fixedData !== data
        }
      };
    } catch (error) {
      return {
        success: false,
        data,
        applied: false,
        patchName: this.name,
        duration: Date.now() - startTime,
        metadata: { 
          error: error instanceof Error ? error.message : String(error) 
        }
      };
    }
  }

  /**
   * 检查是否有工具格式问题
   */
  private hasToolFormatIssues(data: string): boolean {
    // 检查常见的格式问题
    const issues = [
      // 中文引号问题
      /[""]/,
      // 单引号问题
      /'/,
      // 工具调用文本格式
      /Tool call:/i,
      // 非标准JSON格式
      /\{\s*[^"]/,
      // 缺少引号的属性名
      /\{\s*\w+\s*:/
    ];

    return issues.some(pattern => pattern.test(data));
  }

  /**
   * 修复流式工具格式
   */
  private fixStreamingToolFormat(data: string, context: PatchContext): string {
    let fixed = data;

    // 1. 修复中文引号
    fixed = fixed.replace(/[""]/g, '"');

    // 2. 修复单引号
    fixed = fixed.replace(/'/g, '"');

    // 3. 处理工具调用文本格式
    if (fixed.includes('Tool call:')) {
      fixed = this.extractToolCallFromText(fixed);
    }

    // 4. 修复JSON格式问题
    fixed = this.fixJsonFormat(fixed);

    // 5. 处理特定模型的格式问题
    fixed = this.fixModelSpecificIssues(fixed, context.model);

    return fixed;
  }

  /**
   * 从文本中提取工具调用
   */
  private extractToolCallFromText(text: string): string {
    // 匹配 "Tool call: FunctionName({...})" 格式
    const toolCallMatch = text.match(/Tool call:\s*(\w+)\s*\((\{.*?\})\)/);
    if (toolCallMatch) {
      try {
        const [, functionName, argsJson] = toolCallMatch;
        const args = JSON.parse(argsJson);
        return JSON.stringify(args);
      } catch (error) {
        // 如果解析失败，返回原始文本
        return text;
      }
    }

    return text;
  }

  /**
   * 修复JSON格式问题
   */
  private fixJsonFormat(data: string): string {
    // 如果不是JSON格式，直接返回
    if (!data.trim().startsWith('{') && !data.trim().startsWith('[')) {
      return data;
    }

    try {
      // 尝试解析，如果成功则无需修复
      JSON.parse(data);
      return data;
    } catch (error) {
      // 尝试修复常见的JSON问题
      let fixed = data;

      // 修复缺少引号的属性名
      fixed = fixed.replace(/\{\s*(\w+)\s*:/g, '{"$1":');
      fixed = fixed.replace(/,\s*(\w+)\s*:/g, ',"$1":');

      // 修复尾随逗号
      fixed = fixed.replace(/,\s*}/g, '}');
      fixed = fixed.replace(/,\s*]/g, ']');

      // 验证修复结果
      try {
        JSON.parse(fixed);
        return fixed;
      } catch (fixError) {
        // 如果修复失败，返回原始数据
        return data;
      }
    }
  }

  /**
   * 修复特定模型的格式问题
   */
  private fixModelSpecificIssues(data: string, model: string): string {
    let fixed = data;

    // GLM模型特定问题
    if (model.includes('glm') || model.includes('zhipu')) {
      // GLM可能返回特殊的工具调用格式
      fixed = this.fixGLMToolFormat(fixed);
    }

    // Qwen模型特定问题
    if (model.includes('qwen')) {
      // Qwen可能有特定的格式问题
      fixed = this.fixQwenToolFormat(fixed);
    }

    // DeepSeek模型特定问题
    if (model.includes('deepseek')) {
      // DeepSeek可能有特定的格式问题
      fixed = this.fixDeepSeekToolFormat(fixed);
    }

    return fixed;
  }

  /**
   * 修复GLM模型的工具格式
   */
  private fixGLMToolFormat(data: string): string {
    // GLM可能返回特殊格式，这里添加具体的修复逻辑
    return data;
  }

  /**
   * 修复Qwen模型的工具格式
   */
  private fixQwenToolFormat(data: string): string {
    // Qwen模型可能返回工具调用的特殊格式
    // 例如: {"name": "Task", "arguments": "{\n  \"description\": \"检查补丁系统\"}
    try {
      // 尝试解析数据
      const parsed = JSON.parse(data);
      
      // 如果有name和arguments字段，这可能是一个工具调用
      if (parsed.name && parsed.arguments) {
        // 构造标准的工具调用格式
        const toolCall = {
          function: {
            name: parsed.name,
            arguments: typeof parsed.arguments === 'string' 
              ? parsed.arguments 
              : JSON.stringify(parsed.arguments)
          }
        };
        return JSON.stringify(toolCall);
      }
      
      return data;
    } catch (error) {
      // 如果不是有效的JSON，尝试其他修复方法
      
      // 处理可能的工具调用格式，例如:
      // Task({"description": "检查补丁系统", ...})
      const functionCallMatch = data.match(/(\w+)\((\{.*\})\)/s);
      if (functionCallMatch) {
        const [, functionName, args] = functionCallMatch;
        try {
          // 验证参数是有效的JSON
          JSON.parse(args);
          return JSON.stringify({
            function: {
              name: functionName,
              arguments: args
            }
          });
        } catch (e) {
          // 参数不是有效的JSON，保持原样
          return data;
        }
      }
      
      // 尝试修复常见的JSON格式问题
      let fixed = data;
      
      // 修复属性名缺少引号的问题
      fixed = fixed.replace(/(\w+)(?=\s*:)/g, '"$1"');
      
      // 修复多余的逗号
      fixed = fixed.replace(/,(?=\s*[}\]])/g, '');
      
      return fixed;
    }
  }

  /**
   * 修复DeepSeek模型的工具格式
   */
  private fixDeepSeekToolFormat(data: string): string {
    // DeepSeek可能返回特殊格式，这里添加具体的修复逻辑
    return data;
  }
}