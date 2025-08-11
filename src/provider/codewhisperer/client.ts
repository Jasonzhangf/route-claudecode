/**
 * CodeWhisperer Client Implementation
 * Real implementation using the official AWS SDK for CodeWhisperer
 */

import { CodeWhispererClient as AWSCodeWhispererClient, GenerateCompletionsCommand, ListRecommendationsCommand } from '@aws-sdk/client-codewhisperer';
import { fromEnv, fromIni, fromInstanceMetadata } from '@aws-sdk/credential-providers';
import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse, ModelInfo, ProviderConfig, AuthResult } from '../../types/interfaces.js';
import { CodeWhispererConverter } from './converter.js';
import { CodeWhispererParser } from './parser.js';
import { CodeWhispererAuth } from './auth.js';

export class CodeWhispererClient extends BaseProvider {
  private converter: CodeWhispererConverter;
  private parser: CodeWhispererParser;
  private auth: CodeWhispererAuth;
  private codewhispererSDK?: AWSCodeWhispererClient;

  constructor() {
    super('codewhisperer', '1.0.0');
    this.converter = new CodeWhispererConverter();
    this.parser = new CodeWhispererParser();
    this.auth = new CodeWhispererAuth();
  }

  async initialize(config: ProviderConfig): Promise<void> {
    await super.initialize(config);
    
    // Initialize CodeWhisperer-specific authentication
    await this.auth.initialize(config);
    
    // Initialize official AWS CodeWhisperer SDK
    const credentials = await this.getCredentials(config);
    
    this.codewhispererSDK = new AWSCodeWhispererClient({
      region: config.endpoint?.includes('region=') 
        ? new URL(config.endpoint).searchParams.get('region') || 'us-east-1'
        : 'us-east-1',
      credentials,
      maxAttempts: config.retryAttempts || 3
    });

    console.log('✅ CodeWhisperer SDK initialized successfully');
  }

  private async getCredentials(config: ProviderConfig): Promise<any> {
    // Try different credential providers in order of preference
    try {
      // 1. Try environment variables
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        return fromEnv();
      }
      
      // 2. Try AWS credentials file
      return fromIni();
    } catch (error) {
      // 3. Try instance metadata (for EC2)
      try {
        return fromInstanceMetadata();
      } catch (metadataError) {
        // 4. Use provided credentials if available
        if (config.apiKey && config.endpoint?.includes('secretKey=')) {
          const url = new URL(config.endpoint);
          return {
            accessKeyId: config.apiKey,
            secretAccessKey: url.searchParams.get('secretKey') || '',
            sessionToken: url.searchParams.get('sessionToken')
          };
        }
        
        throw new Error('No valid AWS credentials found');
      }
    }
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    if (!this.codewhispererSDK) {
      throw new Error('CodeWhisperer SDK not initialized');
    }

    try {
      // Validate authentication
      if (!await this.validateToken()) {
        const authResult = await this.refreshToken();
        if (!authResult.success) {
          throw new Error('Authentication failed');
        }
      }

      // Convert request to CodeWhisperer format
      const codewhispererRequest = await this.converter.toCodeWhispererFormat(request);
      
      // Make API call using official SDK
      let response;
      if (this.isCodeCompletionRequest(request)) {
        response = await this.handleCodeCompletion(codewhispererRequest);
      } else {
        response = await this.handleChatRequest(codewhispererRequest);
      }

      // Parse and convert response
      return await this.parser.parseResponse(response);
      
    } catch (error) {
      const providerError = this.handleSDKError(error);
      
      if (this.shouldRetry(providerError)) {
        await this.delay(providerError.retryAfter || 1000);
        return this.processRequest(request);
      }
      
      throw providerError;
    }
  }

  private isCodeCompletionRequest(request: AIRequest): boolean {
    // Check if this is a code completion request based on context
    const lastMessage = request.messages[request.messages.length - 1];
    return lastMessage?.content.includes('```') || 
           request.metadata?.source === 'code-completion' ||
           request.model.includes('completion');
  }

  private async handleCodeCompletion(codewhispererRequest: any): Promise<any> {
    if (!this.codewhispererSDK) {
      throw new Error('CodeWhisperer SDK not initialized');
    }

    const command = new GenerateCompletionsCommand({
      fileContext: {
        filename: codewhispererRequest.filename || 'untitled.js',
        programmingLanguage: {
          languageName: codewhispererRequest.language || 'javascript'
        },
        leftFileContent: codewhispererRequest.prefix || '',
        rightFileContent: codewhispererRequest.suffix || ''
      },
      maxResults: codewhispererRequest.maxResults || 5
    });

    return await this.codewhispererSDK.send(command);
  }

  private async handleChatRequest(codewhispererRequest: any): Promise<any> {
    if (!this.codewhispererSDK) {
      throw new Error('CodeWhisperer SDK not initialized');
    }

    // CodeWhisperer doesn't have a direct chat API, so we'll use recommendations
    const command = new ListRecommendationsCommand({
      fileContext: {
        filename: 'chat.txt',
        programmingLanguage: {
          languageName: 'plaintext'
        },
        leftFileContent: codewhispererRequest.prompt || ''
      },
      maxResults: 1
    });

    return await this.codewhispererSDK.send(command);
  }

  async getModels(): Promise<ModelInfo[]> {
    // CodeWhisperer models (based on AWS documentation)
    return [
      {
        id: 'amazon.codewhisperer-v1',
        name: 'Amazon CodeWhisperer',
        provider: this.name,
        capabilities: ['code-generation', 'code-completion', 'code-explanation'],
        maxTokens: 4096,
        contextWindow: 8192,
        pricing: {
          inputTokens: 0, // Free tier available
          outputTokens: 0
        }
      },
      {
        id: 'amazon.codewhisperer-pro-v1',
        name: 'Amazon CodeWhisperer Pro',
        provider: this.name,
        capabilities: ['code-generation', 'code-completion', 'code-explanation', 'security-scanning'],
        maxTokens: 8192,
        contextWindow: 16384,
        pricing: {
          inputTokens: 0.02, // Per request pricing
          outputTokens: 0.02
        }
      }
    ];
  }

  protected async performHealthCheck(): Promise<void> {
    if (!this.codewhispererSDK) {
      throw new Error('CodeWhisperer SDK not initialized');
    }

    try {
      // Make a simple request to verify API connectivity
      const command = new GenerateCompletionsCommand({
        fileContext: {
          filename: 'health-check.js',
          programmingLanguage: {
            languageName: 'javascript'
          },
          leftFileContent: '// Health check',
          rightFileContent: ''
        },
        maxResults: 1
      });

      await this.codewhispererSDK.send(command);
    } catch (error) {
      throw new Error(`CodeWhisperer health check failed: ${error.message}`);
    }
  }

  protected async performAuthentication(): Promise<AuthResult> {
    return await this.auth.authenticate();
  }

  protected async performTokenRefresh(): Promise<AuthResult> {
    return await this.auth.refreshToken();
  }

  protected async performTokenValidation(): Promise<boolean> {
    return this.auth.isTokenValid();
  }

  async convertRequest(request: AIRequest, targetFormat: string): Promise<any> {
    if (targetFormat === 'codewhisperer') {
      return await this.converter.toCodeWhispererFormat(request);
    } else if (targetFormat === 'openai') {
      return await this.converter.toOpenAIFormat(request);
    } else if (targetFormat === 'anthropic') {
      return await this.converter.toAnthropicFormat(request);
    }
    
    return super.convertRequest(request, targetFormat);
  }

  async convertResponse(response: any, sourceFormat: string): Promise<AIResponse> {
    if (sourceFormat === 'codewhisperer') {
      return await this.parser.parseResponse(response);
    }
    
    return super.convertResponse(response, sourceFormat);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to get SDK instance for advanced usage
  getSDK(): AWSCodeWhispererClient | undefined {
    return this.codewhispererSDK;
  }

  // Method to handle SDK-specific errors
  protected handleSDKError(error: any): any {
    // AWS SDK error handling
    if (error.name === 'UnauthorizedOperation' || error.name === 'InvalidUserPoolConfigurationException') {
      return {
        code: `CODEWHISPERER_AUTH_ERROR_${error.name}`,
        message: error.message,
        type: 'authentication',
        retryable: false,
        originalError: error
      };
    }

    if (error.name === 'ThrottlingException' || error.name === 'TooManyRequestsException') {
      return {
        code: `CODEWHISPERER_THROTTLING_${error.name}`,
        message: error.message,
        type: 'rate-limit',
        retryable: true,
        retryAfter: error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : 60000,
        originalError: error
      };
    }

    if (error.name === 'ServiceUnavailableException' || error.name === 'InternalServerException') {
      return {
        code: `CODEWHISPERER_SERVER_ERROR_${error.name}`,
        message: error.message,
        type: 'server',
        retryable: true,
        originalError: error
      };
    }

    if (error.name === 'ValidationException' || error.name === 'InvalidParameterValueException') {
      return {
        code: `CODEWHISPERER_VALIDATION_ERROR_${error.name}`,
        message: error.message,
        type: 'validation',
        retryable: false,
        originalError: error
      };
    }

    return this.handleError(error);
  }

  // Method to get supported programming languages
  getSupportedLanguages(): string[] {
    return [
      'javascript',
      'typescript',
      'python',
      'java',
      'csharp',
      'cpp',
      'c',
      'php',
      'ruby',
      'go',
      'rust',
      'kotlin',
      'scala',
      'swift',
      'objectivec',
      'sql',
      'html',
      'css',
      'json',
      'yaml',
      'xml',
      'shell'
    ];
  }

  // Method to detect programming language from filename
  detectLanguage(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cs': 'csharp',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'kt': 'kotlin',
      'scala': 'scala',
      'swift': 'swift',
      'm': 'objectivec',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sh': 'shell'
    };
    
    return languageMap[extension || ''] || 'plaintext';
  }
}

console.log('✅ CodeWhisperer client loaded - using official SDK');