#!/usr/bin/env node

/**
 * Provider Template Generator
 * Author: Jason Zhang
 * 
 * Generates complete provider template following Task 6.6 guidelines
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate provider template
 */
async function generateProviderTemplate(providerName, options = {}) {
    console.log(`🎯 Generating provider template for: ${providerName}`);
    
    const {
        hasOfficialSDK = false,
        apiFormat = 'openai', // 'openai', 'anthropic', 'gemini', 'custom'
        authMethod = 'apikey', // 'apikey', 'oauth', 'custom'
        supportsStreaming = true,
        supportsToolCalling = false
    } = options;
    
    const capitalizedName = capitalize(providerName);
    const camelName = toCamelCase(providerName);
    
    // Create provider directory
    const providerDir = path.join(process.cwd(), 'src', 'provider', providerName);
    await fs.mkdir(providerDir, { recursive: true });
    
    console.log(`📁 Created directory: ${providerDir}`);
    
    // Generate files
    await generateIndexFile(providerDir, capitalizedName);
    await generateTypesFile(providerDir, capitalizedName, options);
    await generateAuthFile(providerDir, capitalizedName, authMethod);
    await generateConverterFile(providerDir, capitalizedName, apiFormat);
    await generateParserFile(providerDir, capitalizedName, supportsStreaming);
    await generatePreprocessorFile(providerDir, capitalizedName);
    await generateClientFile(providerDir, capitalizedName, hasOfficialSDK);
    
    // Generate test files
    const testDir = path.join(process.cwd(), 'test', 'functional');
    await generateTestFile(testDir, providerName, capitalizedName);
    await generateTestDocumentation(testDir, providerName, capitalizedName);
    
    // Generate validation test
    await generateValidationTest(testDir, providerName, capitalizedName);
    
    console.log(`✅ Provider template generated successfully!`);
    console.log(`📋 Next steps:`);
    console.log(`   1. Review generated files in: ${providerDir}`);
    console.log(`   2. Customize implementation details`);
    console.log(`   3. Run validation: node test/functional/test-${providerName}-validation.js`);
    console.log(`   4. Run integration test: node test/functional/test-${providerName}-integration.js`);
}

/**
 * Generate index.ts file
 */
async function generateIndexFile(providerDir, capitalizedName) {
    const content = `/**
 * ${capitalizedName} Provider
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 */

export { ${capitalizedName}Client } from './client.js';
export { ${capitalizedName}AuthManager } from './auth.js';
export { ${capitalizedName}Converter } from './converter.js';
export { ${capitalizedName}Parser } from './parser.js';
export { ${capitalizedName}Preprocessor } from './preprocessor.js';
export * from './types.js';

console.log('🎯 ${capitalizedName} Provider loaded');
`;

    await fs.writeFile(path.join(providerDir, 'index.ts'), content);
    console.log(`✅ Generated: index.ts`);
}

/**
 * Generate types.ts file
 */
async function generateTypesFile(providerDir, capitalizedName, options) {
    const content = `/**
 * ${capitalizedName} Provider Types
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 */

import { AIRequest, AIResponse } from '../types.js';

export interface ${capitalizedName}Config {
  apiKey: string;
  endpoint: string;
  timeout: number;
  retryAttempts: number;
  models: string[];
  ${options.hasOfficialSDK ? `// Official SDK configuration options\n  sdkOptions?: Record<string, any>;` : ''}
  ${options.authMethod === 'oauth' ? `// OAuth configuration\n  clientId?: string;\n  clientSecret?: string;` : ''}
}

export interface ${capitalizedName}Request {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  ${options.supportsStreaming ? 'stream?: boolean;' : ''}
  ${options.supportsToolCalling ? 'tools?: any[];' : ''}
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  // Add provider-specific fields here
}

export interface ${capitalizedName}Response {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content: string;
      ${options.supportsToolCalling ? 'tool_calls?: any[];' : ''}
    };
    delta?: {
      role?: string;
      content?: string;
      ${options.supportsToolCalling ? 'tool_calls?: any[];' : ''}
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

${options.supportsStreaming ? `export interface ${capitalizedName}StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      ${options.supportsToolCalling ? 'tool_calls?: any[];' : ''}
    };
    finish_reason: string | null;
  }>;
}` : ''}

export interface ${capitalizedName}ErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

export interface ${capitalizedName}ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  capabilities: string[];
}
`;

    await fs.writeFile(path.join(providerDir, 'types.ts'), content);
    console.log(`✅ Generated: types.ts`);
}

/**
 * Generate auth.ts file
 */
async function generateAuthFile(providerDir, capitalizedName, authMethod) {
    const content = `/**
 * ${capitalizedName} Authentication Manager
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 */

import { AuthManager } from '../auth/auth-manager.js';
import { ${capitalizedName}Config } from './types.js';

export class ${capitalizedName}AuthManager extends AuthManager {
  private config: ${capitalizedName}Config;
  ${authMethod === 'oauth' ? 'private accessToken?: string;\n  private refreshToken?: string;' : ''}

  constructor(config: ${capitalizedName}Config) {
    super();
    this.config = config;
  }

  async authenticate(): Promise<boolean> {
    try {
      ${authMethod === 'apikey' ? `
      // Validate API key format and accessibility
      if (!this.config.apiKey || this.config.apiKey.length < 10) {
        throw new Error('Invalid API key format');
      }
      
      // Test API key with a simple health check
      const response = await this.testApiKey();
      return response.success;` : ''}
      
      ${authMethod === 'oauth' ? `
      // OAuth authentication flow
      const tokenResponse = await this.obtainOAuthToken();
      this.accessToken = tokenResponse.access_token;
      this.refreshToken = tokenResponse.refresh_token;
      return true;` : ''}
      
      ${authMethod === 'custom' ? `
      // Custom authentication logic
      // Implement provider-specific authentication here
      return true;` : ''}
      
    } catch (error) {
      console.error(\`❌ \${capitalizedName} authentication failed:\`, error.message);
      return false;
    }
  }

  ${authMethod === 'oauth' ? `async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    // Implement OAuth token refresh logic
    const tokenResponse = await this.obtainOAuthToken(this.refreshToken);
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token;
  }` : ''}

  getAuthHeaders(): Record<string, string> {
    ${authMethod === 'apikey' ? `return {
      'Authorization': \`Bearer \${this.config.apiKey}\`,
      'Content-Type': 'application/json'
    };` : ''}
    
    ${authMethod === 'oauth' ? `return {
      'Authorization': \`Bearer \${this.accessToken}\`,
      'Content-Type': 'application/json'
    };` : ''}
    
    ${authMethod === 'custom' ? `return {
      // Add custom authentication headers
      'Content-Type': 'application/json'
    };` : ''}
  }

  async validateAuthentication(): Promise<boolean> {
    try {
      const headers = this.getAuthHeaders();
      // Perform validation request to provider
      return true;
    } catch (error) {
      return false;
    }
  }

  ${authMethod === 'apikey' ? `private async testApiKey(): Promise<{ success: boolean }> {
    // Implement API key validation
    // This should make a minimal API call to verify the key works
    return { success: true };
  }` : ''}

  ${authMethod === 'oauth' ? `private async obtainOAuthToken(refreshToken?: string): Promise<any> {
    // Implement OAuth token acquisition
    // This should handle both initial token and refresh scenarios
    return {
      access_token: 'mock_token',
      refresh_token: 'mock_refresh_token'
    };
  }` : ''}
}
`;

    await fs.writeFile(path.join(providerDir, 'auth.ts'), content);
    console.log(`✅ Generated: auth.ts`);
}

/**
 * Generate converter.ts file
 */
async function generateConverterFile(providerDir, capitalizedName, apiFormat) {
    const content = `/**
 * ${capitalizedName} Format Converter
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 */

import { AIRequest, AIResponse } from '../types.js';
import { ${capitalizedName}Request, ${capitalizedName}Response } from './types.js';

export class ${capitalizedName}Converter {
  /**
   * Convert standard AIRequest to ${capitalizedName} format
   */
  async toProviderFormat(request: AIRequest): Promise<${capitalizedName}Request> {
    ${apiFormat === 'openai' ? `
    // OpenAI-compatible format conversion
    return {
      model: this.mapModelName(request.model),
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: request.stream || false,
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 1000,
      top_p: request.top_p || 1.0
    };` : ''}
    
    ${apiFormat === 'anthropic' ? `
    // Anthropic-compatible format conversion
    return {
      model: this.mapModelName(request.model),
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: request.max_tokens || 1000,
      temperature: request.temperature || 0.7,
      top_p: request.top_p || 1.0
    };` : ''}
    
    ${apiFormat === 'gemini' ? `
    // Gemini-compatible format conversion
    return {
      model: this.mapModelName(request.model),
      messages: request.messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        temperature: request.temperature || 0.7,
        maxOutputTokens: request.max_tokens || 1000,
        topP: request.top_p || 1.0
      }
    };` : ''}
    
    ${apiFormat === 'custom' ? `
    // Custom format conversion - implement based on provider API
    return {
      model: this.mapModelName(request.model),
      messages: request.messages,
      // Add custom formatting logic here
    };` : ''}
  }

  /**
   * Convert ${capitalizedName} response to standard AIResponse format
   */
  async fromProviderFormat(response: ${capitalizedName}Response): Promise<AIResponse> {
    return {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      choices: response.choices.map(choice => ({
        index: choice.index,
        message: choice.message ? {
          role: choice.message.role,
          content: choice.message.content || ''
        } : undefined,
        delta: choice.delta ? {
          role: choice.delta.role,
          content: choice.delta.content || ''
        } : undefined,
        finish_reason: choice.finish_reason
      })),
      usage: response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens
      } : undefined
    };
  }

  /**
   * Map standard model names to provider-specific model names
   */
  private mapModelName(modelName: string): string {
    const modelMap: Record<string, string> = {
      // Standard to ${capitalizedName} model mapping
      'claude-3-sonnet': '${providerName.toLowerCase()}-large',
      'claude-3-haiku': '${providerName.toLowerCase()}-small',
      'gpt-4': '${providerName.toLowerCase()}-premium',
      'gpt-3.5-turbo': '${providerName.toLowerCase()}-standard',
      // Add more mappings as needed
    };

    return modelMap[modelName] || modelName;
  }

  /**
   * Validate request format before conversion
   */
  validateRequest(request: AIRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.model) {
      errors.push('Model is required');
    }

    if (!request.messages || request.messages.length === 0) {
      errors.push('Messages array is required and cannot be empty');
    }

    if (request.messages) {
      request.messages.forEach((msg, index) => {
        if (!msg.role || !msg.content) {
          errors.push(\`Message at index \${index} missing role or content\`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate response format after conversion
   */
  validateResponse(response: ${capitalizedName}Response): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!response.id) {
      errors.push('Response ID is required');
    }

    if (!response.choices || response.choices.length === 0) {
      errors.push('Response choices are required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
`;

    await fs.writeFile(path.join(providerDir, 'converter.ts'), content);
    console.log(`✅ Generated: converter.ts`);
}

/**
 * Generate parser.ts file
 */
async function generateParserFile(providerDir, capitalizedName, supportsStreaming) {
    const content = `/**
 * ${capitalizedName} Response Parser
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 */

import { ${capitalizedName}Response, ${supportsStreaming ? capitalizedName + 'StreamChunk, ' : ''}${capitalizedName}ErrorResponse } from './types.js';

export class ${capitalizedName}Parser {
  /**
   * Parse standard JSON response
   */
  parseResponse(responseData: any): ${capitalizedName}Response {
    try {
      // Handle error responses
      if (responseData.error) {
        throw new Error(\`${capitalizedName} API Error: \${responseData.error.message}\`);
      }

      // Validate required fields
      if (!responseData.id || !responseData.choices) {
        throw new Error('Invalid response format: missing required fields');
      }

      return {
        id: responseData.id,
        object: responseData.object || 'chat.completion',
        created: responseData.created || Date.now(),
        model: responseData.model,
        choices: responseData.choices.map((choice: any, index: number) => ({
          index: choice.index !== undefined ? choice.index : index,
          message: choice.message ? {
            role: choice.message.role,
            content: choice.message.content || ''
          } : undefined,
          finish_reason: choice.finish_reason || null
        })),
        usage: responseData.usage ? {
          prompt_tokens: responseData.usage.prompt_tokens || 0,
          completion_tokens: responseData.usage.completion_tokens || 0,
          total_tokens: responseData.usage.total_tokens || 0
        } : undefined
      };
    } catch (error) {
      console.error(\`❌ ${capitalizedName} response parsing failed:\`, error.message);
      throw error;
    }
  }

  ${supportsStreaming ? `/**
   * Parse streaming response chunk
   */
  parseStreamChunk(chunkData: string): ${capitalizedName}StreamChunk | null {
    try {
      // Handle server-sent events format
      if (chunkData.startsWith('data: ')) {
        chunkData = chunkData.slice(6).trim();
      }

      if (chunkData === '[DONE]') {
        return null;
      }

      const parsed = JSON.parse(chunkData);

      return {
        id: parsed.id,
        object: parsed.object || 'chat.completion.chunk',
        created: parsed.created || Date.now(),
        model: parsed.model,
        choices: parsed.choices.map((choice: any, index: number) => ({
          index: choice.index !== undefined ? choice.index : index,
          delta: {
            role: choice.delta?.role,
            content: choice.delta?.content || ''
          },
          finish_reason: choice.finish_reason || null
        }))
      };
    } catch (error) {
      console.warn(\`⚠️ Failed to parse stream chunk: \${chunkData}\`, error.message);
      return null;
    }
  }

  /**
   * Process streaming response
   */
  async *processStreamingResponse(response: Response): AsyncGenerator<${capitalizedName}StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const chunk = this.parseStreamChunk(line);
            if (chunk) {
              yield chunk;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }` : ''}

  /**
   * Parse error response
   */
  parseError(errorData: any): Error {
    if (errorData.error) {
      return new Error(\`${capitalizedName} API Error [\${errorData.error.type || 'unknown'}]: \${errorData.error.message}\`);
    }

    return new Error(\`${capitalizedName} API Error: \${JSON.stringify(errorData)}\`);
  }

  /**
   * Extract finish reason from response
   */
  extractFinishReason(response: ${capitalizedName}Response): string | null {
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].finish_reason;
    }
    return null;
  }

  /**
   * Calculate token usage from response
   */
  calculateTokenUsage(response: ${capitalizedName}Response): { prompt: number; completion: number; total: number } {
    if (response.usage) {
      return {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens
      };
    }

    // Estimate token usage if not provided
    const content = response.choices?.[0]?.message?.content || '';
    const estimatedTokens = Math.ceil(content.length / 4); // Rough estimation

    return {
      prompt: 0,
      completion: estimatedTokens,
      total: estimatedTokens
    };
  }
}
`;

    await fs.writeFile(path.join(providerDir, 'parser.ts'), content);
    console.log(`✅ Generated: parser.ts`);
}

/**
 * Generate preprocessor.ts file
 */
async function generatePreprocessorFile(providerDir, capitalizedName) {
    const content = `/**
 * ${capitalizedName} Preprocessing Logic
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 */

import { AIRequest, AIResponse } from '../types.js';
import { ${capitalizedName}Config, ${capitalizedName}Request } from './types.js';

export class ${capitalizedName}Preprocessor {
  private config: ${capitalizedName}Config;

  constructor(config: ${capitalizedName}Config) {
    this.config = config;
  }

  /**
   * Preprocess request before sending to ${capitalizedName} API
   */
  async preprocessRequest(request: AIRequest): Promise<AIRequest> {
    const processed = { ...request };

    // Model name preprocessing
    processed.model = this.preprocessModelName(processed.model);

    // Message preprocessing
    if (processed.messages) {
      processed.messages = await this.preprocessMessages(processed.messages);
    }

    // Parameter preprocessing
    processed = this.preprocessParameters(processed);

    // Tool calling preprocessing
    if (processed.tools) {
      processed.tools = await this.preprocessTools(processed.tools);
    }

    return processed;
  }

  /**
   * Postprocess response after receiving from ${capitalizedName} API
   */
  async postprocessResponse(response: AIResponse): Promise<AIResponse> {
    const processed = { ...response };

    // Content postprocessing
    if (processed.choices) {
      processed.choices = await Promise.all(
        processed.choices.map(async choice => ({
          ...choice,
          message: choice.message ? {
            ...choice.message,
            content: await this.postprocessContent(choice.message.content)
          } : choice.message
        }))
      );
    }

    return processed;
  }

  /**
   * Preprocess model name for ${capitalizedName} compatibility
   */
  private preprocessModelName(model: string): string {
    const modelMappings: Record<string, string> = {
      // Add model name mappings specific to this provider
      'claude-3-sonnet-20240229': '${providerName.toLowerCase()}-large',
      'claude-3-haiku-20240307': '${providerName.toLowerCase()}-fast',
      'gpt-4': '${providerName.toLowerCase()}-premium',
      'gpt-3.5-turbo': '${providerName.toLowerCase()}-standard'
    };

    const mapped = modelMappings[model];
    if (mapped) {
      console.log(\`🔄 Model mapping: \${model} → \${mapped}\`);
      return mapped;
    }

    // Check if model is supported by this provider
    if (!this.config.models.includes(model)) {
      console.warn(\`⚠️ Model \${model} may not be supported by ${capitalizedName}\`);
    }

    return model;
  }

  /**
   * Preprocess messages for ${capitalizedName} format requirements
   */
  private async preprocessMessages(messages: any[]): Promise<any[]> {
    return messages.map(message => {
      // Handle role mapping
      let role = message.role;
      if (role === 'assistant') {
        role = 'assistant'; // Keep as-is or map to provider-specific role
      }

      // Handle content preprocessing
      let content = message.content;
      if (typeof content === 'string') {
        // Apply content-specific preprocessing
        content = this.preprocessMessageContent(content);
      }

      return {
        ...message,
        role,
        content
      };
    });
  }

  /**
   * Preprocess message content
   */
  private preprocessMessageContent(content: string): string {
    // Apply ${capitalizedName}-specific content transformations
    let processed = content;

    // Example: Replace certain patterns that might not work well with this provider
    processed = processed.replace(/\\[SYSTEM\\]/g, ''); // Remove system markers
    processed = processed.replace(/```json\\n/g, '```\\n'); // Normalize code blocks

    return processed;
  }

  /**
   * Preprocess parameters for ${capitalizedName} requirements
   */
  private preprocessParameters(request: AIRequest): AIRequest {
    const processed = { ...request };

    // Temperature normalization
    if (processed.temperature !== undefined) {
      // Ensure temperature is within valid range for this provider
      processed.temperature = Math.max(0, Math.min(2, processed.temperature));
    }

    // Max tokens adjustment
    if (processed.max_tokens !== undefined) {
      // Apply provider-specific max token limits
      const maxLimit = 4096; // Adjust based on provider limits
      processed.max_tokens = Math.min(processed.max_tokens, maxLimit);
    }

    // Top-p normalization
    if (processed.top_p !== undefined) {
      processed.top_p = Math.max(0.01, Math.min(1.0, processed.top_p));
    }

    return processed;
  }

  /**
   * Preprocess tools/functions for ${capitalizedName} format
   */
  private async preprocessTools(tools: any[]): Promise<any[]> {
    // Convert tools to ${capitalizedName}-compatible format
    return tools.map(tool => {
      // Apply tool format transformations specific to this provider
      return {
        ...tool,
        // Add provider-specific tool formatting
      };
    });
  }

  /**
   * Postprocess content from ${capitalizedName} response
   */
  private async postprocessContent(content: string): Promise<string> {
    if (!content) return content;

    let processed = content;

    // Apply content postprocessing transformations
    processed = processed.trim();
    
    // Fix common formatting issues that might come from this provider
    processed = processed.replace(/\\n\\n\\n+/g, '\\n\\n'); // Normalize multiple newlines
    
    return processed;
  }

  /**
   * Validate preprocessed request
   */
  validatePreprocessedRequest(request: AIRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Model validation
    if (!request.model) {
      errors.push('Model is required after preprocessing');
    }

    // Message validation
    if (!request.messages || request.messages.length === 0) {
      errors.push('Messages are required after preprocessing');
    }

    // Parameter validation
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2 after preprocessing');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get preprocessing statistics
   */
  getPreprocessingStats(): Record<string, number> {
    return {
      modelMappings: 4, // Number of model mappings available
      messageTransforms: 2, // Number of message transformation rules
      parameterAdjustments: 3 // Number of parameter adjustment rules
    };
  }
}
`;

    await fs.writeFile(path.join(providerDir, 'preprocessor.ts'), content);
    console.log(`✅ Generated: preprocessor.ts`);
}

/**
 * Generate client.ts file
 */
async function generateClientFile(providerDir, capitalizedName, hasOfficialSDK) {
    const content = `/**
 * ${capitalizedName} Client
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 */

import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse } from '../types.js';
import { ${capitalizedName}Config, ${capitalizedName}Request, ${capitalizedName}Response } from './types.js';
import { ${capitalizedName}AuthManager } from './auth.js';
import { ${capitalizedName}Converter } from './converter.js';
import { ${capitalizedName}Parser } from './parser.js';
import { ${capitalizedName}Preprocessor } from './preprocessor.js';
${hasOfficialSDK ? `\n// Import official SDK when available\n// import { ${capitalizedName}SDK } from '@${providerName.toLowerCase()}/sdk';` : ''}

export class ${capitalizedName}Client extends BaseProvider {
  ${hasOfficialSDK ? `private sdk?: any; // Official ${capitalizedName} SDK instance` : ''}
  private config: ${capitalizedName}Config;
  private auth: ${capitalizedName}AuthManager;
  private converter: ${capitalizedName}Converter;
  private parser: ${capitalizedName}Parser;
  private preprocessor: ${capitalizedName}Preprocessor;
  private httpClient?: fetch;

  constructor(config: ${capitalizedName}Config) {
    super();
    this.config = config;
    this.auth = new ${capitalizedName}AuthManager(config);
    this.converter = new ${capitalizedName}Converter();
    this.parser = new ${capitalizedName}Parser();
    this.preprocessor = new ${capitalizedName}Preprocessor(config);
  }

  /**
   * Initialize the ${capitalizedName} client
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing ${capitalizedName} client...');

    // Authenticate first
    const authSuccess = await this.auth.authenticate();
    if (!authSuccess) {
      throw new Error('${capitalizedName} authentication failed');
    }

    ${hasOfficialSDK ? `
    // Try to initialize with official SDK first
    try {
      // this.sdk = new ${capitalizedName}SDK({
      //   apiKey: this.config.apiKey,
      //   endpoint: this.config.endpoint,
      //   ...this.config.sdkOptions
      // });
      console.log('✅ Using official ${capitalizedName} SDK');
    } catch (error) {
      console.log('🔄 Official SDK not available, using HTTP client fallback');
      this.initializeHttpClient();
    }` : `
    // Initialize HTTP client
    this.initializeHttpClient();`}

    console.log('✅ ${capitalizedName} client initialized successfully');
  }

  /**
   * Initialize HTTP client fallback
   */
  private initializeHttpClient(): void {
    // Use global fetch or a fetch polyfill
    this.httpClient = globalThis.fetch;
    if (!this.httpClient) {
      throw new Error('Fetch API not available');
    }
  }

  /**
   * Process AI request
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    try {
      // Preprocess request
      const preprocessedRequest = await this.preprocessor.preprocessRequest(request);
      
      // Validate preprocessed request
      const validation = this.preprocessor.validatePreprocessedRequest(preprocessedRequest);
      if (!validation.valid) {
        throw new Error(\`Request validation failed: \${validation.errors.join(', ')}\`);
      }

      // Convert to provider format
      const providerRequest = await this.converter.toProviderFormat(preprocessedRequest);

      let response: AIResponse;

      ${hasOfficialSDK ? `
      // Use official SDK if available
      if (this.sdk) {
        response = await this.processWithSDK(providerRequest);
      } else {
        response = await this.processWithHttp(providerRequest);
      }` : `
      // Use HTTP client
      response = await this.processWithHttp(providerRequest);`}

      // Postprocess response
      const postprocessedResponse = await this.preprocessor.postprocessResponse(response);

      return postprocessedResponse;
    } catch (error) {
      console.error(\`❌ ${capitalizedName} request failed:\`, error.message);
      throw error;
    }
  }

  ${hasOfficialSDK ? `
  /**
   * Process request using official SDK
   */
  private async processWithSDK(request: ${capitalizedName}Request): Promise<AIResponse> {
    try {
      // const sdkResponse = await this.sdk.chat.completions.create(request);
      // const providerResponse = this.normalizeSDKResponse(sdkResponse);
      // return await this.converter.fromProviderFormat(providerResponse);
      
      // Temporary fallback until SDK is properly integrated
      return await this.processWithHttp(request);
    } catch (error) {
      console.warn(\`⚠️ SDK request failed, falling back to HTTP: \${error.message}\`);
      return await this.processWithHttp(request);
    }
  }` : ''}

  /**
   * Process request using HTTP client
   */
  private async processWithHttp(request: ${capitalizedName}Request): Promise<AIResponse> {
    if (!this.httpClient) {
      throw new Error('HTTP client not initialized');
    }

    const headers = {
      ...this.auth.getAuthHeaders(),
      'User-Agent': 'claude-code-router/2.7.0'
    };

    const response = await this.httpClient(this.config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw this.parser.parseError(errorData);
    }

    const responseData = await response.json();
    const parsedResponse = this.parser.parseResponse(responseData);
    return await this.converter.fromProviderFormat(parsedResponse);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const startTime = Date.now();
    
    try {
      // Perform a minimal API call to check health
      const testRequest: AIRequest = {
        model: this.config.models[0] || '${providerName.toLowerCase()}-standard',
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 1
      };

      await this.processRequest(testRequest);
      
      return {
        status: 'healthy',
        latency: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    return this.config.models;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): Record<string, boolean> {
    return {
      streaming: ${supportsStreaming},
      toolCalling: ${supportsToolCalling},
      multiModal: false, // Update based on provider capabilities
      embeddings: false,
      fineTuning: false,
      customModels: true
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Cleanup SDK resources if needed
    ${hasOfficialSDK ? `
    if (this.sdk && typeof this.sdk.cleanup === 'function') {
      await this.sdk.cleanup();
    }` : ''}
    
    console.log('✅ ${capitalizedName} client cleaned up');
  }
}
`;

    await fs.writeFile(path.join(providerDir, 'client.ts'), content);
    console.log(`✅ Generated: client.ts`);
}

/**
 * Generate test file
 */
async function generateTestFile(testDir, providerName, capitalizedName) {
    const content = `#!/usr/bin/env node

/**
 * ${capitalizedName} Integration Test
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main test function for ${capitalizedName} integration
 */
async function test${capitalizedName}Integration() {
    const testResults = {
        testName: '${capitalizedName} Integration Test',
        startTime: new Date().toISOString(),
        tests: [],
        summary: { passed: 0, failed: 0, total: 0 }
    };

    console.log(\`🧪 Starting ${capitalizedName} Integration Test\`);
    console.log(\`📋 Testing ${capitalizedName} provider integration\`);
    
    try {
        // Test 1: Provider Initialization
        await runTest(testResults, '${capitalizedName} Provider Initialization', async () => {
            const { ${capitalizedName}Client } = await import('../../src/provider/${providerName}/client.js');
            
            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.${providerName.toLowerCase()}.com/v1/chat/completions',
                timeout: 30000,
                retryAttempts: 3,
                models: ['${providerName.toLowerCase()}-standard', '${providerName.toLowerCase()}-large']
            };
            
            const client = new ${capitalizedName}Client(config);
            
            // This should not throw an error
            const capabilities = client.getCapabilities();
            if (!capabilities || typeof capabilities !== 'object') {
                throw new Error('Capabilities not properly defined');
            }
            
            const models = await client.getAvailableModels();
            if (!Array.isArray(models) || models.length === 0) {
                throw new Error('No models available');
            }
            
            return {
                capabilities: Object.keys(capabilities).filter(k => capabilities[k]),
                modelsCount: models.length,
                message: \`Provider initialized with \${models.length} models, \${Object.keys(capabilities).filter(k => capabilities[k]).length} capabilities\`
            };
        });

        // Test 2: Authentication Module
        await runTest(testResults, 'Authentication Module', async () => {
            const { ${capitalizedName}AuthManager } = await import('../../src/provider/${providerName}/auth.js');
            
            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.${providerName.toLowerCase()}.com/v1/chat/completions',
                timeout: 30000,
                retryAttempts: 3,
                models: []
            };
            
            const auth = new ${capitalizedName}AuthManager(config);
            const headers = auth.getAuthHeaders();
            
            if (!headers || !headers['Authorization']) {
                throw new Error('Authentication headers not properly generated');
            }
            
            return {
                hasAuthHeader: !!headers['Authorization'],
                hasContentType: !!headers['Content-Type'],
                message: 'Authentication headers generated successfully'
            };
        });

        // Test 3: Format Conversion
        await runTest(testResults, 'Format Conversion', async () => {
            const { ${capitalizedName}Converter } = await import('../../src/provider/${providerName}/converter.js');
            
            const converter = new ${capitalizedName}Converter();
            
            const testRequest = {
                model: 'claude-3-sonnet',
                messages: [
                    { role: 'user', content: 'Hello, world!' }
                ],
                temperature: 0.7,
                max_tokens: 100
            };
            
            // Test conversion to provider format
            const providerRequest = await converter.toProviderFormat(testRequest);
            if (!providerRequest || !providerRequest.model || !providerRequest.messages) {
                throw new Error('Request conversion failed');
            }
            
            // Test validation
            const validation = converter.validateRequest(testRequest);
            if (!validation.valid) {
                throw new Error(\`Request validation failed: \${validation.errors.join(', ')}\`);
            }
            
            return {
                converted: true,
                modelMapped: providerRequest.model !== testRequest.model,
                messagesCount: providerRequest.messages.length,
                message: \`Request converted successfully, model: \${providerRequest.model}\`
            };
        });

        // Test 4: Response Parser
        await runTest(testResults, 'Response Parser', async () => {
            const { ${capitalizedName}Parser } = await import('../../src/provider/${providerName}/parser.js');
            
            const parser = new ${capitalizedName}Parser();
            
            const mockResponse = {
                id: 'test-response-id',
                object: 'chat.completion',
                created: Date.now(),
                model: '${providerName.toLowerCase()}-standard',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: 'Hello! This is a test response.'
                        },
                        finish_reason: 'stop'
                    }
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 8,
                    total_tokens: 18
                }
            };
            
            const parsed = parser.parseResponse(mockResponse);
            
            if (!parsed.id || !parsed.choices || parsed.choices.length === 0) {
                throw new Error('Response parsing failed');
            }
            
            const tokenUsage = parser.calculateTokenUsage(parsed);
            
            return {
                responseId: parsed.id,
                choicesCount: parsed.choices.length,
                finishReason: parser.extractFinishReason(parsed),
                tokenUsage: tokenUsage.total,
                message: \`Response parsed successfully, \${tokenUsage.total} tokens\`
            };
        });

        // Test 5: Preprocessor
        await runTest(testResults, 'Preprocessor Module', async () => {
            const { ${capitalizedName}Preprocessor } = await import('../../src/provider/${providerName}/preprocessor.js');
            
            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.${providerName.toLowerCase()}.com/v1/chat/completions',
                timeout: 30000,
                retryAttempts: 3,
                models: ['${providerName.toLowerCase()}-standard', '${providerName.toLowerCase()}-large']
            };
            
            const preprocessor = new ${capitalizedName}Preprocessor(config);
            
            const testRequest = {
                model: 'claude-3-sonnet',
                messages: [
                    { role: 'user', content: 'Test message with [SYSTEM] markers and extra\\n\\n\\nspacing' }
                ],
                temperature: 2.5, // Out of range, should be adjusted
                max_tokens: 10000 // High value, should be adjusted
            };
            
            const preprocessed = await preprocessor.preprocessRequest(testRequest);
            
            // Verify preprocessing worked
            if (preprocessed.temperature > 2 || preprocessed.max_tokens > 4096) {
                throw new Error('Parameter preprocessing failed');
            }
            
            const validation = preprocessor.validatePreprocessedRequest(preprocessed);
            if (!validation.valid) {
                throw new Error(\`Preprocessed request validation failed: \${validation.errors.join(', ')}\`);
            }
            
            const stats = preprocessor.getPreprocessingStats();
            
            return {
                temperatureAdjusted: preprocessed.temperature <= 2,
                maxTokensAdjusted: preprocessed.max_tokens <= 4096,
                preprocessingRules: Object.values(stats).reduce((sum, count) => sum + count, 0),
                message: \`Preprocessing successful, \${Object.values(stats).reduce((sum, count) => sum + count, 0)} rules applied\`
            };
        });

        // Test 6: Type Definitions
        await runTest(testResults, 'Type Definitions', async () => {
            const types = await import('../../src/provider/${providerName}/types.js');
            
            // Check if types export properly
            const typeNames = Object.keys(types);
            const expectedTypes = ['${capitalizedName}Config', '${capitalizedName}Request', '${capitalizedName}Response'];
            
            const missingTypes = expectedTypes.filter(type => !typeNames.includes(type));
            if (missingTypes.length > 0) {
                throw new Error(\`Missing type definitions: \${missingTypes.join(', ')}\`);
            }
            
            return {
                typeCount: typeNames.length,
                expectedTypes: expectedTypes.length,
                allTypesPresent: missingTypes.length === 0,
                message: \`\${typeNames.length} types exported, all expected types present\`
            };
        });

    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        testResults.tests.push({
            name: 'Test Execution',
            status: 'failed',
            error: error.message,
            duration: 0
        });
    }

    // Finalize results
    testResults.endTime = new Date().toISOString();
    testResults.summary.total = testResults.tests.length;
    testResults.summary.passed = testResults.tests.filter(t => t.status === 'passed').length;
    testResults.summary.failed = testResults.tests.filter(t => t.status === 'failed').length;

    // Save results
    const outputFile = path.join(__dirname, '..', 'output', \`${providerName}-integration-\${Date.now()}.json\`);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(testResults, null, 2));

    // Print summary
    console.log('\\n📊 Test Summary:');
    console.log(\`   ✅ Passed: \${testResults.summary.passed}\`);
    console.log(\`   ❌ Failed: \${testResults.summary.failed}\`);
    console.log(\`   📁 Results saved: \${outputFile}\`);

    return testResults.summary.failed === 0;
}

/**
 * Run individual test with error handling
 */
async function runTest(testResults, testName, testFunction) {
    const startTime = Date.now();
    console.log(\`\\n🧪 Running: \${testName}\`);
    
    try {
        const result = await testFunction();
        const duration = Date.now() - startTime;
        
        testResults.tests.push({
            name: testName,
            status: 'passed',
            duration,
            result: result.message || 'Test passed',
            details: result
        });
        
        console.log(\`   ✅ \${testName} - \${result.message}\`);
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        
        testResults.tests.push({
            name: testName,
            status: 'failed',
            duration,
            error: error.message,
            stack: error.stack
        });
        
        console.log(\`   ❌ \${testName} - \${error.message}\`);
        throw error;
    }
}

// CLI interface
if (import.meta.url === \`file://\${process.argv[1]}\`) {
    test${capitalizedName}Integration()
        .then(success => {
            console.log(\`\\n🎉 ${capitalizedName} Integration Test \${success ? 'PASSED' : 'FAILED'}\`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test runner failed:', error);
            process.exit(1);
        });
}

export { test${capitalizedName}Integration };
`;

    await fs.writeFile(path.join(testDir, `test-${providerName}-integration.js`), content);
    console.log(`✅ Generated: test-${providerName}-integration.js`);
}

/**
 * Generate test documentation
 */
async function generateTestDocumentation(testDir, providerName, capitalizedName) {
    const content = `# ${capitalizedName} Integration Test

## 测试用例
验证${capitalizedName}提供商的完整集成功能

## 测试目标
全面验证${capitalizedName} Provider的6个核心组件：
1. **Provider Initialization** - 提供商初始化和配置验证
2. **Authentication Module** - 认证模块功能测试
3. **Format Conversion** - 格式转换双向验证
4. **Response Parser** - 响应解析和错误处理
5. **Preprocessor Module** - 预处理逻辑验证
6. **Type Definitions** - TypeScript类型定义验证

## 测试架构
\`\`\`
${capitalizedName} Integration Test:
Provider Init → Auth → Converter → Parser → Preprocessor → Types
     ↓
Capabilities → Models → Headers → Format → Parsing → Preprocessing → Types
\`\`\`

## 组件测试详解

### 1. Provider Initialization
- **验证点**: ${capitalizedName}Client初始化和基础功能
- **测试方法**: 创建客户端实例，验证能力和模型列表
- **成功标准**: 能力映射完整，模型列表非空

### 2. Authentication Module
- **验证点**: 认证头生成和管理
- **测试方法**: 创建认证管理器，验证头部格式
- **成功标准**: Authorization和Content-Type头部正确生成

### 3. Format Conversion
- **验证点**: 请求格式转换和验证
- **测试方法**: 测试标准格式到${capitalizedName}格式的转换
- **成功标准**: 转换成功，模型映射正确，验证通过

### 4. Response Parser
- **验证点**: 响应解析和token使用统计
- **测试方法**: 解析模拟响应，提取关键信息
- **成功标准**: 响应正确解析，token统计准确

### 5. Preprocessor Module
- **验证点**: 请求预处理和参数调整
- **测试方法**: 测试参数范围调整和内容处理
- **成功标准**: 参数在有效范围内，预处理规则应用正确

### 6. Type Definitions
- **验证点**: TypeScript类型导出完整性
- **测试方法**: 验证预期类型定义存在
- **成功标准**: 所有预期类型正确导出

## 技术实现细节

### 核心组件验证
- **${capitalizedName}Client**: 主客户端类，完整API封装
- **${capitalizedName}AuthManager**: 认证管理，支持多种认证方式
- **${capitalizedName}Converter**: 格式转换，双向转换支持
- **${capitalizedName}Parser**: 响应解析，错误处理和token统计
- **${capitalizedName}Preprocessor**: 预处理逻辑，参数调整和内容处理
- **类型定义**: 完整TypeScript类型支持

### 架构合规性验证
- **接口标准化**: 实现ProviderClient接口
- **零硬编码**: 所有配置外部化
- **预处理聚焦**: 主要定制在预处理层
- **官方SDK优先**: 支持官方SDK和HTTP客户端回退

## 执行记录

### 最近执行记录
- **执行时间**: 待执行
- **执行状态**: 待测试  
- **执行时长**: -
- **日志文件**: 待生成

### 历史执行记录
暂无历史记录

## 相关文件
- **测试脚本**: \`test/functional/test-${providerName}-integration.js\`
- **日志文件**: \`test/output/${providerName}-integration-*.json\`
- **相关组件**:
  - \`src/provider/${providerName}/\` - ${capitalizedName}提供商完整实现
  - 所有${capitalizedName}组件和类型定义

## 测试结果解读

### 成功指标
- **100% 组件覆盖**: 所有6个核心组件都有对应测试
- **功能验证完整**: 关键功能点全部验证通过
- **类型安全**: TypeScript类型定义完整
- **架构合规**: 遵循Task 6.6提供商集成指导方针

### 警告和限制
- **网络依赖**: 某些测试可能需要网络连接
- **API密钥**: 真实测试需要有效API密钥
- **模型可用性**: 测试结果依赖模型服务可用性

### 故障排查
1. **导入错误**: 检查模块路径和ES模块支持
2. **初始化失败**: 验证配置参数和API密钥
3. **转换失败**: 检查格式转换逻辑和模型映射
4. **解析错误**: 验证响应格式和解析规则

## 依赖关系
- Node.js >= 16 (ES模块支持)
- ${capitalizedName} Provider完整实现
- 测试基础设施
- 可选: 有效的${capitalizedName} API密钥 (用于完整测试)

## 扩展测试
可基于此测试框架扩展以下测试：
- 真实API集成测试
- 并发请求性能测试  
- 错误恢复机制测试
- 流式响应处理测试
`;

    await fs.writeFile(path.join(testDir, `test-${providerName}-integration.md`), content);
    console.log(`✅ Generated: test-${providerName}-integration.md`);
}

/**
 * Generate validation test
 */
async function generateValidationTest(testDir, providerName, capitalizedName) {
    const content = `#!/usr/bin/env node

/**
 * ${capitalizedName} Provider Validation Test
 * Author: Jason Zhang
 * Generated: ${new Date().toISOString()}
 * 
 * Validates ${capitalizedName} provider compliance with Task 6.6 guidelines
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validate ${capitalizedName} provider implementation
 */
async function validate${capitalizedName}Provider() {
    const validationResults = {
        testName: '${capitalizedName} Provider Validation',
        startTime: new Date().toISOString(),
        validations: [],
        summary: { passed: 0, failed: 0, total: 0, compliance: 0 }
    };

    console.log(\`🔍 Starting ${capitalizedName} Provider Validation\`);
    console.log(\`📋 Validating Task 6.6 compliance\`);
    
    try {
        // Validation 1: Directory Structure
        await runValidation(validationResults, 'Directory Structure Compliance', async () => {
            const requiredFiles = [
                'src/provider/${providerName}/index.ts',
                'src/provider/${providerName}/client.ts',
                'src/provider/${providerName}/auth.ts',
                'src/provider/${providerName}/converter.ts',
                'src/provider/${providerName}/parser.ts',
                'src/provider/${providerName}/types.ts',
                'src/provider/${providerName}/preprocessor.ts'
            ];
            
            const missingFiles = [];
            const existingFiles = [];
            
            for (const file of requiredFiles) {
                try {
                    const filePath = path.resolve(process.cwd(), file);
                    await fs.access(filePath);
                    existingFiles.push(file);
                } catch (error) {
                    missingFiles.push(file);
                }
            }
            
            if (missingFiles.length > 0) {
                throw new Error(\`Missing required files: \${missingFiles.join(', ')}\`);
            }
            
            return {
                requiredFiles: requiredFiles.length,
                existingFiles: existingFiles.length,
                message: \`All \${requiredFiles.length} required files present\`
            };
        });

        // Validation 2: Interface Implementation
        await runValidation(validationResults, 'ProviderClient Interface Implementation', async () => {
            const { ${capitalizedName}Client } = await import('../../src/provider/${providerName}/client.js');
            
            const client = new ${capitalizedName}Client({
                apiKey: 'test-key',
                endpoint: 'https://api.example.com',
                timeout: 30000,
                retryAttempts: 3,
                models: ['test-model']
            });
            
            // Check required methods
            const requiredMethods = ['initialize', 'processRequest', 'healthCheck', 'getAvailableModels', 'getCapabilities'];
            const missingMethods = [];
            
            for (const method of requiredMethods) {
                if (typeof client[method] !== 'function') {
                    missingMethods.push(method);
                }
            }
            
            if (missingMethods.length > 0) {
                throw new Error(\`Missing required methods: \${missingMethods.join(', ')}\`);
            }
            
            return {
                implementedMethods: requiredMethods.length,
                missingMethods: missingMethods.length,
                message: \`All \${requiredMethods.length} required methods implemented\`
            };
        });

        // Validation 3: Zero Hardcoding Check
        await runValidation(validationResults, 'Zero Hardcoding Compliance', async () => {
            const filesToCheck = [
                'src/provider/${providerName}/client.ts',
                'src/provider/${providerName}/auth.ts',
                'src/provider/${providerName}/converter.ts',
                'src/provider/${providerName}/parser.ts',
                'src/provider/${providerName}/preprocessor.ts'
            ];
            
            const hardcodingViolations = [];
            
            for (const file of filesToCheck) {
                try {
                    const filePath = path.resolve(process.cwd(), file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    
                    // Check for common hardcoding patterns
                    const violations = [];
                    
                    if (/apiKey:\\s*['"]sk-[a-zA-Z0-9]+['"]/.test(content)) {
                        violations.push('Hardcoded API key');
                    }
                    
                    if (/endpoint:\\s*['"]https:\\/\\/api\\.[a-zA-Z0-9-]+\\.com['"]/.test(content)) {
                        violations.push('Hardcoded endpoint URL');
                    }
                    
                    if (/model:\\s*['"][a-zA-Z0-9-]+['"](?!\\s*\\||\\s*:)/.test(content)) {
                        violations.push('Hardcoded model name');
                    }
                    
                    if (violations.length > 0) {
                        hardcodingViolations.push(\`\${file}: \${violations.join(', ')}\`);
                    }
                    
                } catch (error) {
                    console.warn(\`⚠️ Could not check file \${file}: \${error.message}\`);
                }
            }
            
            if (hardcodingViolations.length > 0) {
                throw new Error(\`Hardcoding violations found: \${hardcodingViolations.join('; ')}\`);
            }
            
            return {
                filesChecked: filesToCheck.length,
                violations: hardcodingViolations.length,
                message: \`No hardcoding violations found in \${filesToCheck.length} files\`
            };
        });

        // Validation 4: Preprocessing Focus
        await runValidation(validationResults, 'Preprocessing-Focused Architecture', async () => {
            const { ${capitalizedName}Preprocessor } = await import('../../src/provider/${providerName}/preprocessor.js');
            
            const config = {
                apiKey: 'test-key',
                endpoint: 'https://api.example.com',
                timeout: 30000,
                retryAttempts: 3,
                models: ['test-model']
            };
            
            const preprocessor = new ${capitalizedName}Preprocessor(config);
            
            // Check preprocessor methods
            const requiredMethods = ['preprocessRequest', 'postprocessResponse', 'validatePreprocessedRequest', 'getPreprocessingStats'];
            const missingMethods = [];
            
            for (const method of requiredMethods) {
                if (typeof preprocessor[method] !== 'function') {
                    missingMethods.push(method);
                }
            }
            
            if (missingMethods.length > 0) {
                throw new Error(\`Missing preprocessor methods: \${missingMethods.join(', ')}\`);
            }
            
            // Verify preprocessing stats
            const stats = preprocessor.getPreprocessingStats();
            if (!stats || typeof stats !== 'object') {
                throw new Error('Preprocessing stats not available');
            }
            
            return {
                implementedMethods: requiredMethods.length,
                preprocessingRules: Object.values(stats).reduce((sum, count) => sum + count, 0),
                message: \`Preprocessor complete with \${Object.values(stats).reduce((sum, count) => sum + count, 0)} rules\`
            };
        });

        // Validation 5: Type Safety
        await runValidation(validationResults, 'TypeScript Type Safety', async () => {
            const types = await import('../../src/provider/${providerName}/types.js');
            
            const expectedTypes = [
                '${capitalizedName}Config',
                '${capitalizedName}Request', 
                '${capitalizedName}Response',
                '${capitalizedName}ErrorResponse'
            ];
            
            const availableTypes = Object.keys(types);
            const missingTypes = expectedTypes.filter(type => !availableTypes.includes(type));
            
            if (missingTypes.length > 0) {
                throw new Error(\`Missing type definitions: \${missingTypes.join(', ')}\`);
            }
            
            return {
                expectedTypes: expectedTypes.length,
                availableTypes: availableTypes.length,
                missingTypes: missingTypes.length,
                message: \`All \${expectedTypes.length} core types defined\`
            };
        });

        // Validation 6: Error Handling
        await runValidation(validationResults, 'Comprehensive Error Handling', async () => {
            const { ${capitalizedName}Parser } = await import('../../src/provider/${providerName}/parser.js');
            
            const parser = new ${capitalizedName}Parser();
            
            // Test error parsing
            const mockError = {
                error: {
                    message: 'Test error message',
                    type: 'invalid_request',
                    code: 'test_error'
                }
            };
            
            try {
                const error = parser.parseError(mockError);
                if (!(error instanceof Error)) {
                    throw new Error('parseError should return Error instance');
                }
                
                if (!error.message.includes('Test error message')) {
                    throw new Error('Error message not properly parsed');
                }
                
            } catch (parseError) {
                throw new Error(\`Error parsing failed: \${parseError.message}\`);
            }
            
            return {
                errorParsingWorks: true,
                message: 'Error handling properly implemented'
            };
        });

        // Validation 7: Documentation Completeness
        await runValidation(validationResults, 'Documentation Completeness', async () => {
            const testFiles = [
                \`test/functional/test-\${providerName}-integration.js\`,
                \`test/functional/test-\${providerName}-integration.md\`
            ];
            
            const missingDocs = [];
            
            for (const file of testFiles) {
                try {
                    const filePath = path.resolve(process.cwd(), file);
                    await fs.access(filePath);
                } catch (error) {
                    missingDocs.push(file);
                }
            }
            
            if (missingDocs.length > 0) {
                throw new Error(\`Missing documentation files: \${missingDocs.join(', ')}\`);
            }
            
            return {
                requiredDocs: testFiles.length,
                availableDocs: testFiles.length - missingDocs.length,
                message: \`All \${testFiles.length} documentation files present\`
            };
        });

    } catch (error) {
        console.error('❌ Validation execution failed:', error.message);
        validationResults.validations.push({
            name: 'Validation Execution',
            status: 'failed',
            error: error.message,
            duration: 0
        });
    }

    // Calculate compliance score
    validationResults.endTime = new Date().toISOString();
    validationResults.summary.total = validationResults.validations.length;
    validationResults.summary.passed = validationResults.validations.filter(v => v.status === 'passed').length;
    validationResults.summary.failed = validationResults.validations.filter(v => v.status === 'failed').length;
    validationResults.summary.compliance = Math.round((validationResults.summary.passed / validationResults.summary.total) * 100);

    // Save results
    const outputFile = path.join(__dirname, '..', 'output', \`\${providerName}-validation-\${Date.now()}.json\`);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(validationResults, null, 2));

    // Print summary
    console.log('\\n📊 Validation Summary:');
    console.log(\`   ✅ Passed: \${validationResults.summary.passed}\`);
    console.log(\`   ❌ Failed: \${validationResults.summary.failed}\`);
    console.log(\`   📈 Compliance: \${validationResults.summary.compliance}%\`);
    console.log(\`   📁 Results saved: \${outputFile}\`);

    // Print detailed results
    console.log('\\n📋 Validation Details:');
    validationResults.validations.forEach(validation => {
        const status = validation.status === 'passed' ? '✅' : '❌';
        console.log(\`   \${status} \${validation.name}: \${validation.result || validation.error}\`);
    });

    const passed = validationResults.summary.compliance >= 85; // 85% compliance threshold
    console.log(\`\\n🎯 Task 6.6 Compliance: \${passed ? 'PASSED' : 'FAILED'} (\${validationResults.summary.compliance}%)\`);

    return passed;
}

/**
 * Run individual validation with error handling
 */
async function runValidation(validationResults, validationName, validationFunction) {
    const startTime = Date.now();
    console.log(\`\\n🔍 Validating: \${validationName}\`);
    
    try {
        const result = await validationFunction();
        const duration = Date.now() - startTime;
        
        validationResults.validations.push({
            name: validationName,
            status: 'passed',
            duration,
            result: result.message || 'Validation passed',
            details: result
        });
        
        console.log(\`   ✅ \${validationName} - \${result.message}\`);
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        
        validationResults.validations.push({
            name: validationName,
            status: 'failed',
            duration,
            error: error.message,
            stack: error.stack
        });
        
        console.log(\`   ❌ \${validationName} - \${error.message}\`);
        throw error;
    }
}

// CLI interface
if (import.meta.url === \`file://\${process.argv[1]}\`) {
    validate${capitalizedName}Provider()
        .then(success => {
            console.log(\`\\n🎉 ${capitalizedName} Provider Validation \${success ? 'PASSED' : 'FAILED'}\`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Validation runner failed:', error);
            process.exit(1);
        });
}

export { validate${capitalizedName}Provider };
`;

    await fs.writeFile(path.join(testDir, `test-${providerName}-validation.js`), content);
    console.log(`✅ Generated: test-${providerName}-validation.js`);
}

/**
 * Utility functions
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str) {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const providerName = process.argv[2];
    const options = {};
    
    // Parse command line options
    for (let i = 3; i < process.argv.length; i += 2) {
        const key = process.argv[i];
        const value = process.argv[i + 1];
        
        switch (key) {
            case '--official-sdk':
                options.hasOfficialSDK = value === 'true';
                break;
            case '--api-format':
                options.apiFormat = value;
                break;
            case '--auth-method':
                options.authMethod = value;
                break;
            case '--streaming':
                options.supportsStreaming = value === 'true';
                break;
            case '--tool-calling':
                options.supportsToolCalling = value === 'true';
                break;
        }
    }
    
    if (!providerName) {
        console.error('❌ Usage: node generate-provider-template.js <provider-name> [options]');
        console.error('   Options:');
        console.error('     --official-sdk true/false');
        console.error('     --api-format openai/anthropic/gemini/custom');
        console.error('     --auth-method apikey/oauth/custom');
        console.error('     --streaming true/false');
        console.error('     --tool-calling true/false');
        process.exit(1);
    }
    
    generateProviderTemplate(providerName, options)
        .catch(error => {
            console.error('💥 Template generation failed:', error);
            process.exit(1);
        });
}

export { generateProviderTemplate };