/**
 * CodeWhisperer AWS Binary Event Stream Parser
 * Handles AWS CodeWhisperer's binary event stream format
 */

import { logger } from '@/utils/logger';

export interface ParsedEvent {
  event: string;
  data: any;
}

export interface SSEEvent {
  Event: string;
  Data: any;
}

export interface AWSBinaryEvent {
  headers: Record<string, any>;
  payload: string;
  payloadJSON?: any;
}

/**
 * Parse CodeWhisperer AWS Binary Event Stream from raw response
 * Handles the binary format returned by CodeWhisperer API
 */
export function parseEvents(rawResponse: Buffer): SSEEvent[] {
  try {
    logger.debug('Parsing AWS Binary Event Stream', {
      responseLength: rawResponse.length,
      responsePreview: rawResponse.toString('hex').substring(0, 100)
    });
    
    const binaryEvents = parseAWSBinaryEvents(rawResponse);
    const sseEvents: SSEEvent[] = [];
    
    logger.debug('Binary events parsed', {
      eventCount: binaryEvents.length
    });
    
    // Convert AWS binary events to SSE format
    for (const binaryEvent of binaryEvents) {
      const sseEvent = convertBinaryEventToSSE(binaryEvent);
      if (sseEvent) {
        sseEvents.push(sseEvent);
      }
    }
    
    logger.debug('Events converted to SSE format', {
      eventCount: sseEvents.length,
      eventTypes: sseEvents.map(e => e.Event)
    });
    
    return sseEvents;
  } catch (error) {
    logger.error('Failed to parse AWS Binary Event Stream', error);
    return [];
  }
}

/**
 * Parse AWS Binary Event Stream format
 */
function parseAWSBinaryEvents(buffer: Buffer): AWSBinaryEvent[] {
  const events: AWSBinaryEvent[] = [];
  let offset = 0;
  
  while (offset < buffer.length) {
    try {
      const event = parseEventAtOffset(buffer, offset);
      if (event) {
        events.push(event.data);
        offset = event.nextOffset;
      } else {
        break;
      }
    } catch (error) {
      logger.debug('Failed to parse event at offset', { offset, error });
      break;
    }
  }
  
  return events;
}

/**
 * Parse single AWS event at given offset
 */
function parseEventAtOffset(buffer: Buffer, offset: number): { data: AWSBinaryEvent; nextOffset: number } | null {
  if (offset + 12 > buffer.length) {
    return null;
  }

  // AWS Event Stream format:
  // 4 bytes: total message length
  // 4 bytes: headers length  
  // 4 bytes: CRC of prelude
  // headers
  // payload
  // 4 bytes: message CRC

  const totalLength = buffer.readUInt32BE(offset);
  const headersLength = buffer.readUInt32BE(offset + 4);
  
  if (offset + totalLength > buffer.length) {
    return null;
  }

  // Parse headers
  const headersStart = offset + 12;
  const headers = parseHeaders(buffer, headersStart, headersLength);
  
  // Parse payload
  const payloadStart = headersStart + headersLength;
  const payloadLength = totalLength - 12 - headersLength - 4;
  const payload = buffer.slice(payloadStart, payloadStart + payloadLength);
  
  const eventData: AWSBinaryEvent = {
    headers: headers,
    payload: payload.toString('utf8')
  };

  // Try to parse JSON payload
  try {
    eventData.payloadJSON = JSON.parse(eventData.payload);
  } catch {
    // Payload is not JSON, keep as string
  }

  return {
    data: eventData,
    nextOffset: offset + totalLength
  };
}

/**
 * Parse AWS event headers
 */
function parseHeaders(buffer: Buffer, start: number, length: number): Record<string, any> {
  const headers: Record<string, any> = {};
  let offset = start;
  const end = start + length;

  while (offset < end) {
    if (offset + 4 > end) break;

    const nameLength = buffer.readUInt8(offset);
    offset += 1;

    if (offset + nameLength > end) break;

    const name = buffer.slice(offset, offset + nameLength).toString('utf8');
    offset += nameLength;

    if (offset + 3 > end) break;

    const valueType = buffer.readUInt8(offset);
    offset += 1;

    const valueLength = buffer.readUInt16BE(offset);
    offset += 2;

    if (offset + valueLength > end) break;

    let value;
    if (valueType === 7) { // String
      value = buffer.slice(offset, offset + valueLength).toString('utf8');
    } else {
      value = buffer.slice(offset, offset + valueLength);
    }

    headers[name] = value;
    offset += valueLength;
  }

  return headers;
}

/**
 * Convert AWS binary event to SSE format
 */
function convertBinaryEventToSSE(binaryEvent: AWSBinaryEvent): SSEEvent | null {
  try {
    // Extract event type from headers
    const eventType = binaryEvent.headers[':event-type'] || 'assistantResponseEvent';
    
    // Use JSON payload if available, otherwise use raw payload
    const data = binaryEvent.payloadJSON || { text: binaryEvent.payload };
    
    return {
      Event: eventType,
      Data: data
    };
  } catch (error) {
    logger.debug('Failed to convert binary event to SSE', { error, binaryEvent });
    return null;
  }
}


/**
 * Convert CodeWhisperer events to Anthropic format
 */
export function convertEventsToAnthropic(events: SSEEvent[], requestId: string): ParsedEvent[] {
  const anthropicEvents: ParsedEvent[] = [];
  
  try {
    logger.debug('Converting events to Anthropic format', {
      inputEventCount: events.length,
      inputEventTypes: events.map(e => e.Event)
    }, requestId);
    
    for (const event of events) {
      const converted = convertSingleEvent(event, requestId);
      if (converted) {
        anthropicEvents.push(converted);
        logger.debug('Event converted successfully', {
          originalEvent: event.Event,
          convertedEvent: converted.event
        }, requestId);
      } else {
        logger.debug('Event conversion returned null', {
          originalEvent: event.Event,
          eventData: event.Data
        }, requestId);
      }
    }
    
    logger.debug('Event conversion completed', {
      outputEventCount: anthropicEvents.length,
      outputEventTypes: anthropicEvents.map(e => e.event)
    }, requestId);
    
    return anthropicEvents;
  } catch (error) {
    logger.error('Failed to convert events to Anthropic format', error, requestId);
    return [];
  }
}

/**
 * Convert single CodeWhisperer event to Anthropic format
 */
function convertSingleEvent(event: SSEEvent, requestId: string): ParsedEvent | null {
  try {
    const { Event, Data } = event;
    
    logger.debug('Converting single event', {
      eventType: Event,
      dataKeys: Data ? Object.keys(Data) : [],
      dataPreview: typeof Data === 'object' ? JSON.stringify(Data).substring(0, 100) : Data
    }, requestId);
    
    // Handle different event types
    switch (Event) {
      case 'assistantResponseEvent':
        return convertAssistantResponseEvent(Data, requestId);
      
      case 'toolUseEvent':
        return convertToolUseEvent(Data, requestId);
      
      case 'codeGenerationEvent':
        return convertCodeGenerationEvent(Data, requestId);
      
      case 'messageStart':
        return {
          event: 'message_start',
          data: Data
        };
      
      case 'contentBlockStart':
        return {
          event: 'content_block_start',
          data: Data
        };
      
      case 'contentBlockDelta':
        return convertContentBlockDelta(Data, requestId);
      
      case 'contentBlockStop':
        return {
          event: 'content_block_stop',
          data: Data
        };
      
      case 'messageStop':
        return {
          event: 'message_stop',
          data: Data
        };
      
      default:
        logger.debug('Unknown event type, treating as text content', { eventType: Event, data: Data }, requestId);
        
        // Handle AWS binary events that have direct text content
        if (Data && typeof Data === 'object' && Data.text) {
          return {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',  
              index: 0,
              delta: {
                type: 'text_delta',
                text: Data.text
              }
            }
          };
        }
        
        // Handle AWS binary events with content field
        if (Data && typeof Data === 'object' && Data.content) {
          return {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: 0,
              delta: {
                type: 'text_delta',
                text: Data.content
              }
            }
          };
        }
        
        return null;
    }
  } catch (error) {
    logger.error('Failed to convert single event', error, requestId);
    return null;
  }
}

/**
 * Convert tool use event (based on CodeWhisperer's toolUseEvent format)
 */
function convertToolUseEvent(data: any, requestId: string): ParsedEvent | null {
  try {
    logger.debug('Converting tool use event', {
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : [],
      hasToolUseId: !!(data && data.toolUseId),
      hasName: !!(data && data.name),
      hasInput: !!(data && data.input),
      hasStop: !!(data && data.stop)
    }, requestId);

    // Handle tool use events (similar to demo2's assistantResponseEvent with toolUseId)
    if (data && data.toolUseId && data.name) {
      // Tool use completion (stop: true)
      if (data.stop) {
        logger.debug('Tool use completion event', {
          toolUseId: data.toolUseId,
          name: data.name
        }, requestId);
        
        return {
          event: 'content_block_stop',
          data: {
            type: 'content_block_stop',
            index: 1
          }
        };
      }
      
      // Tool input streaming (partial JSON)
      if (data.input && !data.stop) {
        logger.debug('Tool input streaming event', {
          toolUseId: data.toolUseId,
          name: data.name,
          inputLength: data.input.length
        }, requestId);
        
        return {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 1,
            delta: {
              type: 'input_json_delta',
              partial_json: data.input
            }
          }
        };
      }
      
      // Tool use start event (no input yet and no stop)
      if (!data.input && !data.stop) {
        logger.debug('Tool use start event', {
          toolUseId: data.toolUseId,
          name: data.name
        }, requestId);
        
        return {
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index: 1,
            content_block: {
              type: 'tool_use',
              id: data.toolUseId,
              name: data.name,
              input: {}
            }
          }
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.debug('Failed to convert tool use event', error, requestId);
    return null;
  }
}

/**
 * Convert assistant response event (based on demo2 implementation)
 */
function convertAssistantResponseEvent(data: any, requestId: string): ParsedEvent | null {
  try {
    logger.debug('Converting assistant response event', {
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : [],
      hasContent: !!(data && data.content),
      hasToolUseId: !!(data && data.toolUseId),
      hasName: !!(data && data.name),
      hasInput: !!(data && data.input),
      stop: !!(data && data.stop)
    }, requestId);
    
    // Handle tool use events (from demo2)
    if (data && data.toolUseId && data.name) {
      // Tool use start event
      if (data.input === null || data.input === undefined) {
        logger.debug('Tool use start event', {
          toolUseId: data.toolUseId,
          name: data.name
        }, requestId);
        
        return {
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index: 1,
            content_block: {
              type: 'tool_use',
              id: data.toolUseId,
              name: data.name,
              input: {}
            }
          }
        };
      }
      
      // Tool input streaming (partial JSON)
      if (data.input && !data.stop) {
        logger.debug('Tool input streaming event', {
          toolUseId: data.toolUseId,
          name: data.name,
          inputLength: data.input.length
        }, requestId);
        
        return {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 1,
            delta: {
              type: 'input_json_delta',
              id: data.toolUseId,
              name: data.name,
              partial_json: data.input
            }
          }
        };
      }
      
      // Tool use completion
      if (data.stop) {
        logger.debug('Tool use completion event', {
          toolUseId: data.toolUseId,
          name: data.name
        }, requestId);
        
        // For tool completion, we need to return message_delta with tool_use stop reason
        return {
          event: 'message_delta',
          data: {
            type: 'message_delta',
            delta: {
              stop_reason: 'tool_use',
              stop_sequence: null
            },
            usage: {
              output_tokens: 0
            }
          }
        };
      }
    }
    
    // Handle text content (new AWS binary format)
    if (data && data.content) {
      return {
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: data.content
          }
        }
      };
    }
    
    // Handle legacy format
    if (data && data.assistantResponseEvent && data.assistantResponseEvent.content) {
      return {
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: data.assistantResponseEvent.content
          }
        }
      };
    }
    
    return null;
  } catch (error) {
    logger.debug('Failed to convert assistant response event', error, requestId);
    return null;
  }
}

/**
 * Convert code generation event
 */
function convertCodeGenerationEvent(data: any, requestId: string): ParsedEvent | null {
  try {
    if (data.codeGenerationEvent && data.codeGenerationEvent.content) {
      return {
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: data.codeGenerationEvent.content
          }
        }
      };
    }
    return null;
  } catch (error) {
    logger.debug('Failed to convert code generation event', error, requestId);
    return null;
  }
}

/**
 * Convert content block delta event
 */
function convertContentBlockDelta(data: any, requestId: string): ParsedEvent | null {
  try {
    // Handle different delta types
    if (data.delta) {
      switch (data.delta.type) {
        case 'text_delta':
          return {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: data.index || 0,
              delta: {
                type: 'text_delta',
                text: data.delta.text || ''
              }
            }
          };
        
        case 'input_json_delta':
          return {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: data.index || 1,
              delta: {
                type: 'input_json_delta',
                partial_json: data.delta.partial_json || ''
              }
            }
          };
        
        default:
          return {
            event: 'content_block_delta',
            data: data
          };
      }
    }
    
    return {
      event: 'content_block_delta',
      data: data
    };
  } catch (error) {
    logger.debug('Failed to convert content block delta', error, requestId);
    return null;
  }
}

/**
 * Parse non-streaming response from CodeWhisperer
 */
export function parseNonStreamingResponse(rawResponse: Buffer, requestId: string): any {
  try {
    const events = parseEvents(rawResponse);
    const contexts: any[] = [];
    
    logger.debug('parseNonStreamingResponse: parsed events', {
      eventCount: events.length,
      eventTypes: events.map(e => e.Event)
    }, requestId);
    
    // Convert SSE events to Anthropic format first
    const anthropicEvents = convertEventsToAnthropic(events, requestId);
    
    logger.debug('parseNonStreamingResponse: converted to Anthropic format', {
      anthropicEventCount: anthropicEvents.length,
      eventTypes: anthropicEvents.map(e => e.event)
    }, requestId);
    
    let currentContext = '';
    let toolName = '';
    let toolUseId = '';
    let partialJsonStr = '';
    let hasTextContent = false;
    let hasToolContent = false;
    
    for (const event of anthropicEvents) {
      if (event.data && typeof event.data === 'object') {
        const dataMap = event.data;
        
        logger.debug('Processing event in parseNonStreamingResponse', {
          eventType: event.event,
          dataType: dataMap.type,
          dataKeys: Object.keys(dataMap),
          eventIndex: anthropicEvents.indexOf(event)
        }, requestId);
        
        switch (dataMap.type) {
          case 'content_block_start':
            currentContext = '';
            // For tool use blocks, capture the tool information
            if (dataMap.content_block && dataMap.content_block.type === 'tool_use') {
              toolUseId = dataMap.content_block.id || '';
              toolName = dataMap.content_block.name || '';
              partialJsonStr = ''; // Reset partial JSON for new tool
              hasToolContent = true;
              
              logger.debug('Captured tool info from content_block_start', {
                toolUseId,
                toolName,
                contentBlock: dataMap.content_block
              }, 'parseNonStreamingResponse');
            }
            break;
          
          case 'content_block_delta':
            if (dataMap.delta) {
              switch (dataMap.delta.type) {
                case 'text_delta':
                  if (dataMap.delta.text) {
                    currentContext += dataMap.delta.text;
                    hasTextContent = true;
                  }
                  break;
                
                case 'input_json_delta':
                  toolUseId = dataMap.delta.id || toolUseId;
                  toolName = dataMap.delta.name || toolName;
                  if (dataMap.delta.partial_json) {
                    partialJsonStr += dataMap.delta.partial_json;
                    hasToolContent = true;
                  }
                  break;
              }
            }
            break;
          
          case 'content_block_stop':
            const index = dataMap.index || 0;
            
            if (index === 1) {
              // Tool use block
              let toolInput: any = {};
              try {
                toolInput = JSON.parse(partialJsonStr);
              } catch (error) {
                logger.warn('Failed to parse tool input JSON', error, requestId);
              }
              
              contexts.push({
                type: 'tool_use',
                id: toolUseId,
                name: toolName,
                input: toolInput
              });
              hasToolContent = false; // Reset flag
            } else if (index === 0) {
              // Text block
              contexts.push({
                type: 'text',
                text: currentContext
              });
              hasTextContent = false; // Reset flag
            }
            break;
        }
      }
    }
    
    // 修复：如果有文本内容但没有content_block_stop事件，直接添加文本内容
    if (hasTextContent && currentContext.trim()) {
      contexts.push({
        type: 'text',
        text: currentContext
      });
      logger.debug('Added text content without content_block_stop event', {
        textLength: currentContext.length
      }, requestId);
    }
    
    // 修复：如果有工具内容但没有content_block_stop事件，直接添加工具内容
    if (hasToolContent && toolUseId && toolName) {
      let toolInput: any = {};
      try {
        toolInput = JSON.parse(partialJsonStr);
      } catch (error) {
        logger.warn('Failed to parse tool input JSON without content_block_stop', error, requestId);
      }
      
      contexts.push({
        type: 'tool_use',
        id: toolUseId,
        name: toolName,
        input: toolInput
      });
      logger.debug('Added tool content without content_block_stop event', {
        toolName,
        toolUseId
      }, requestId);
    }
    
    return contexts;
  } catch (error) {
    logger.error('Failed to parse non-streaming response', error, requestId);
    return [{ type: 'text', text: 'Error parsing response' }];
  }
}