/**
 * CodeWhisperer SSE Parser
 * 完全基于demo2 parser/sse_parser.go 移植的二进制响应解析器
 * 集成 demo3 的 bracket 工具调用解析功能
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { AssistantResponseEvent, SSEEvent } from './types';
import { 
  parseBracketToolCalls, 
  deduplicateToolCalls, 
  cleanToolCallSyntax,
  BracketToolCall 
} from './bracket-tool-parser';

export class CodeWhispererParser {
  /**
   * 解析CodeWhisperer的二进制响应 (完全基于demo2的ParseEvents函数)
   */
  public parseEvents(responseBuffer: Buffer): SSEEvent[] {
    const events: SSEEvent[] = [];
    let offset = 0;

    logger.debug('开始解析CodeWhisperer响应', {
      bufferLength: responseBuffer.length,
    });

    while (offset < responseBuffer.length) {
      // 检查是否有足够的字节读取帧头 (基于demo2的长度检查)
      if (responseBuffer.length - offset < 12) {
        logger.debug('剩余字节不足12，停止解析', {
          remaining: responseBuffer.length - offset,
        });
        break;
      }

      // 读取总长度和头部长度 (基于demo2的binary.Read逻辑)
      const totalLen = responseBuffer.readUInt32BE(offset);
      const headerLen = responseBuffer.readUInt32BE(offset + 4);
      offset += 8;

      logger.debug('读取帧信息', {
        totalLen,
        headerLen,
        currentOffset: offset,
      });

      // 验证帧长度 (基于demo2的长度验证)
      if (totalLen > responseBuffer.length - offset + 8) {
        logger.warn('帧长度无效，停止解析', {
          totalLen,
          remainingBytes: responseBuffer.length - offset + 8,
        });
        break;
      }

      // 跳过头部 (基于demo2的header跳过逻辑)
      if (headerLen > 0) {
        const header = responseBuffer.subarray(offset, offset + headerLen);
        offset += headerLen;
        
        logger.debug('跳过头部', {
          headerLen,
          headerPreview: header.toString('hex').substring(0, 40),
        });
      }

      // 读取payload (基于demo2的payload读取)
      const payloadLen = totalLen - headerLen - 12;
      if (payloadLen <= 0) {
        // 跳过CRC32并继续
        offset += 4;
        continue;
      }

      const payload = responseBuffer.subarray(offset, offset + payloadLen);
      offset += payloadLen;

      // 跳过CRC32 (基于demo2的CRC32跳过)
      offset += 4;

      // 处理payload (基于demo2的payload处理)
      let payloadStr = payload.toString('utf8');
      
      // 移除"vent"前缀 (基于demo2的TrimPrefix逻辑)
      if (payloadStr.startsWith('vent')) {
        payloadStr = payloadStr.substring(4);
      }

      logger.debug('解析payload', {
        payloadLen,
        payloadPreview: payloadStr.substring(0, 100),
      });

      // 尝试解析为JSON (基于demo2的json.Unmarshal)
      try {
        const evt: AssistantResponseEvent = JSON.parse(payloadStr);
        
        logger.debug('成功解析事件', {
          hasContent: !!evt.content,
          hasToolInfo: !!(evt.toolUseId && evt.name),
          stop: evt.stop,
        });

        // 转换为SSE事件 (基于demo2的convertAssistantEventToSSE)
        const sseEvent = this.convertAssistantEventToSSE(evt);
        if (sseEvent.event) { // 只添加有效事件
          events.push(sseEvent);
        }

        // 处理工具调用的特殊情况 (基于demo2的工具调用处理)
        if (evt.toolUseId && evt.name && evt.stop) {
          const stopEvent: SSEEvent = {
            event: 'message_delta',
            data: {
              type: 'message_delta',
              delta: {
                stop_reason: 'tool_use',
                stop_sequence: null,
              },
              usage: { output_tokens: 0 },
            },
          };
          events.push(stopEvent);
          
          logger.debug('添加工具调用停止事件');
        }

      } catch (parseError) {
        logger.warn('JSON解析失败', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          payloadPreview: payloadStr.substring(0, 200),
        });
      }
    }

    logger.debug('CodeWhisperer响应解析完成', {
      totalEvents: events.length,
      parsedBytes: offset,
      totalBytes: responseBuffer.length,
    });

    return events;
  }

  /**
   * 将AssistantResponseEvent转换为SSEEvent (完全基于demo2的convertAssistantEventToSSE函数)
   */
  private convertAssistantEventToSSE(evt: AssistantResponseEvent): SSEEvent {
    // 文本内容事件 (基于demo2的文本处理)
    if (evt.content) {
      return {
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: evt.content,
          },
        },
      };
    }
    
    // 工具调用事件 (基于demo2的工具调用处理)
    if (evt.toolUseId && evt.name && !evt.stop) {
      if (!evt.input) {
        // 工具调用开始事件
        return {
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index: 1,
            content_block: {
              type: 'tool_use',
              id: evt.toolUseId,
              name: evt.name,
              input: {},
            },
          },
        };
      } else {
        // 工具调用输入增量事件
        return {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 1,
            delta: {
              type: 'input_json_delta',
              id: evt.toolUseId,
              name: evt.name,
              partial_json: evt.input,
            },
          },
        };
      }
    }
    
    // 停止事件 (基于demo2的停止处理)
    if (evt.stop) {
      return {
        event: 'content_block_stop',
        data: {
          type: 'content_block_stop',
          index: 1,
        },
      };
    }

    // 无效事件
    return { event: '', data: null };
  }

  /**
   * 缓冲式工具调用解析 - 完全基于demo2策略
   * 先完整缓冲所有JSON片段，再统一解析
   */
  public buildNonStreamResponse(events: SSEEvent[], originalModel: string): any {
    const contexts: any[] = [];
    
    // 缓冲状态管理
    let textBuffer = '';
    let toolCallBuffer = new Map<string, {
      id: string;
      name: string;
      jsonFragments: string[];
      isComplete: boolean;
    }>();
    
    logger.debug('开始缓冲式响应构建', {
      eventCount: events.length,
      originalModel,
    });

    // 第一阶段：完整缓冲所有数据
    for (const event of events) {
      if (!event.data || typeof event.data !== 'object') continue;

      const dataMap = event.data as any;
      
      switch (dataMap.type) {
        case 'content_block_start':
          if (dataMap.content_block && dataMap.content_block.type === 'tool_use') {
            const toolId = dataMap.content_block.id;
            const toolName = dataMap.content_block.name;
            
            // 🔧 关键修复：只在工具不存在时才初始化，避免重复初始化导致片段丢失
            if (!toolCallBuffer.has(toolId)) {
              toolCallBuffer.set(toolId, {
                id: toolId,
                name: toolName,
                jsonFragments: [],
                isComplete: false
              });
              
              logger.debug('初始化工具调用缓冲区', { toolId, toolName });
            } else {
              logger.debug('工具调用缓冲区已存在，跳过重复初始化', { 
                toolId, 
                toolName,
                existingFragments: toolCallBuffer.get(toolId)!.jsonFragments.length
              });
            }
          }
          break;

        case 'content_block_delta':
          if (dataMap.delta) {
            const deltaMap = dataMap.delta;
            
            switch (deltaMap.type) {
              case 'text_delta':
                if (deltaMap.text) {
                  textBuffer += deltaMap.text;
                  logger.debug('缓冲文本片段', { fragment: deltaMap.text });
                }
                break;

              case 'input_json_delta':
                const toolId = deltaMap.id;
                if (deltaMap.partial_json && toolCallBuffer.has(toolId)) {
                  toolCallBuffer.get(toolId)!.jsonFragments.push(deltaMap.partial_json);
                  logger.debug('缓冲JSON片段', { 
                    toolId, 
                    fragment: deltaMap.partial_json,
                    totalFragments: toolCallBuffer.get(toolId)!.jsonFragments.length
                  });
                }
                break;
            }
          }
          break;

        case 'content_block_stop':
          const index = dataMap.index;
          logger.debug('内容块停止', { index });
          
          if (index === 1) {
            // 标记工具调用完成
            for (const [toolId, toolData] of Array.from(toolCallBuffer.entries())) {
              if (!toolData.isComplete) {
                toolData.isComplete = true;
                logger.debug('工具调用标记完成', { toolId });
                break; // 只标记第一个未完成的
              }
            }
          } else if (index === 0 && textBuffer) {
            // 文本内容完成
            contexts.push({
              type: 'text',
              text: textBuffer
            });
            logger.debug('添加文本内容', { textLength: textBuffer.length });
            textBuffer = ''; // 重置文本缓冲区
          }
          break;
      }
    }

    // 第二阶段：处理完整的工具调用缓冲区
    for (const [toolId, toolData] of Array.from(toolCallBuffer.entries())) {
      if (toolData.isComplete && toolData.jsonFragments.length > 0) {
        const completeJsonStr = toolData.jsonFragments.join('');
        logger.debug('合并JSON片段', { 
          toolId, 
          fragmentCount: toolData.jsonFragments.length,
          completeJson: completeJsonStr
        });
        
        try {
          const toolInput = JSON.parse(completeJsonStr);
          contexts.push({
            type: 'tool_use',
            id: toolData.id,
            name: toolData.name,
            input: toolInput
          });
          logger.debug('成功解析工具调用', { 
            toolId: toolData.id, 
            toolName: toolData.name,
            inputKeys: Object.keys(toolInput)
          });
        } catch (parseError) {
          logger.warn('工具JSON解析失败，添加为文本', {
            toolId: toolData.id,
            error: parseError instanceof Error ? parseError.message : String(parseError),
            jsonString: completeJsonStr
          });
          
          // 解析失败时作为文本处理
          contexts.push({
            type: 'text',
            text: `Tool call: ${toolData.name}(${completeJsonStr})`
          });
        }
      }
    }

    // 处理遗留的文本缓冲区
    if (textBuffer && contexts.length === 0) {
      contexts.push({
        type: 'text',
        text: textBuffer
      });
      logger.debug('添加遗留文本内容', { textLength: textBuffer.length });
    }

    // 🔧 集成 demo3 的 bracket 工具调用解析 (关键修复)
    const rawResponseText = textBuffer || '';
    const bracketToolCalls = parseBracketToolCalls(rawResponseText);
    
    logger.debug('Bracket 工具调用解析结果', {
      rawTextLength: rawResponseText.length,
      bracketToolCallsFound: bracketToolCalls.length,
      bracketToolNames: bracketToolCalls.map(tc => tc.function.name)
    });

    // 将 bracket 工具调用转换为标准格式并添加到 contexts
    if (bracketToolCalls.length > 0) {
      for (const bracketCall of bracketToolCalls) {
        try {
          const toolInput = JSON.parse(bracketCall.function.arguments);
          contexts.push({
            type: 'tool_use',
            id: bracketCall.id,
            name: bracketCall.function.name,
            input: toolInput
          });
          
          logger.debug('成功添加 bracket 工具调用', {
            toolId: bracketCall.id,
            toolName: bracketCall.function.name,
            inputKeys: Object.keys(toolInput)
          });
        } catch (parseError) {
          logger.error('解析 bracket 工具调用参数失败', {
            toolId: bracketCall.id,
            toolName: bracketCall.function.name,
            error: (parseError as Error).message
          });
        }
      }
    }

    // 清理文本中的工具调用语法
    const cleanedText = cleanToolCallSyntax(rawResponseText, bracketToolCalls);
    if (cleanedText !== rawResponseText && cleanedText.trim()) {
      // 如果清理后的文本不同且非空，替换或添加文本内容
      const textIndex = contexts.findIndex(c => c.type === 'text');
      if (textIndex >= 0) {
        contexts[textIndex] = { type: 'text', text: cleanedText };
      } else if (contexts.length === 0 || contexts.every(c => c.type === 'tool_use')) {
        contexts.unshift({ type: 'text', text: cleanedText });
      }
    }

    // 确定 stop_reason
    const hasAnyToolUse = contexts.some(c => c.type === 'tool_use');
    const stopReason = hasAnyToolUse ? 'tool_use' : 'end_turn';

    // 构建最终响应
    const response = {
      content: contexts,
      model: originalModel,
      role: 'assistant',
      stop_reason: stopReason,
      stop_sequence: null,
      type: 'message',
      usage: {
        input_tokens: Math.max(1, Math.floor((textBuffer.length || 50) / 4)),
        output_tokens: Math.max(1, Math.floor((textBuffer.length || 50) / 4)),
      },
    };

    logger.debug('增强缓冲式响应构建完成', {
      contextCount: contexts.length,
      textBufferLength: textBuffer.length,
      structuredToolCallCount: Array.from(toolCallBuffer.values()).filter(t => t.isComplete).length,
      bracketToolCallCount: bracketToolCalls.length,
      totalToolCallCount: contexts.filter(c => c.type === 'tool_use').length,
      hasToolUse: hasAnyToolUse,
      stopReason,
      finalContexts: contexts.map(c => ({ type: c.type, hasContent: !!(c.text || c.input) }))
    });

    return response;
  }
}