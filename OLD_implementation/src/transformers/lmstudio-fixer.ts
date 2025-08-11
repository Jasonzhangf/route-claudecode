/**
 * LM Studio Response Fixer
 * 
 * This module is specifically designed to handle the non-standard way
 * some LM Studio models return tool calls. Instead of using the dedicated
 * `tool_calls` array in the response, they embed the tool call as a
 * string within the `content` field, often wrapped in <tool_call> tags.
 *
 * This fixer detects and extracts these embedded tool calls, converting
 * them into the standard OpenAI format.
 */

import { logger } from '@/utils/logger';

const TOOL_CALL_REGEX = /<tool_call>\s*(\{.*?\})\s*<\/tool_call>/s;

/**
 * Represents a standard OpenAI tool call structure.
 */
interface StandardToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Represents a standard OpenAI choice structure in the response.
 */
interface StandardChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: StandardToolCall[];
  };
  finish_reason: string;
}

/**
 * Represents a standard OpenAI API response structure.
 */
interface StandardOpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StandardChoice[];
}

/**
 * Pre-processes a response from LM Studio to handle embedded tool calls.
 *
 * @param response The raw response object from an OpenAI-compatible service.
 * @param requestId Optional request ID for logging.
 * @returns A standardized OpenAI response object with tool calls correctly formatted.
 */
export function fixLmStudioResponse(response: any, requestId?: string): StandardOpenAIResponse {
  if (!response.choices || response.choices.length === 0) {
    return response;
  }

  const choice = response.choices[0];
  const content = choice.message?.content;

  if (typeof content !== 'string') {
    return response;
  }

  const match = content.match(TOOL_CALL_REGEX);

  if (match) {
    const extractedJson = match[1];
    try {
      const toolCallContent = JSON.parse(extractedJson);
      
      const newToolCall: StandardToolCall = {
        id: `call_${Date.now()}`,
        type: 'function',
        function: {
          name: toolCallContent.name,
          arguments: JSON.stringify(toolCallContent.arguments),
        },
      };

      // Remove the tool_call block from the original content
      const newContent = content.replace(TOOL_CALL_REGEX, '').trim();

      const newChoice: StandardChoice = {
        ...choice,
        message: {
          ...choice.message,
          content: newContent || null,
          tool_calls: [newToolCall],
        },
        // IMPORTANT: Change finish_reason to signal a tool call
        finish_reason: 'tool_calls',
      };
      
      const newResponse: StandardOpenAIResponse = {
        ...response,
        choices: [newChoice],
      };

      logger.info('Successfully fixed LM Studio embedded tool call', {
        originalContent: content,
        newContent: newContent,
        extractedTool: newToolCall.function.name,
      }, requestId, 'lmstudio-fixer');

      return newResponse;

    } catch (error) {
      logger.error('Failed to parse embedded tool call JSON from LM Studio response', {
        json: extractedJson,
        error: error instanceof Error ? error.message : String(error),
      }, requestId, 'lmstudio-fixer');
    }
  }

  return response;
}
