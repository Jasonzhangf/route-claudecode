/**
 * Enhanced Format Converter
 * Unified bidirectional format conversion with intelligent streaming support
 */

import { AIRequest, AIResponse, Tool } from '../../types/interfaces.js';
import { StreamingManager, StreamingConfig, StreamChunk } from './streaming-manager.js';
import { ProtocolSelector, ProtocolDecision } from './protocol-selector.js';

export type SupportedFormat = 'anthropic' | 'openai' | 'gemini' | 'codewhisperer' | 'standard';

export interface FormatConverter {
  name: string;
  supportedFormats: SupportedFormat[];
  convertRequest(request: AIRequest, targetFormat: SupportedFormat): Promise<any>;
  convertResponse(response: any, sourceFormat: SupportedFormat): Promise<AIResponse>;
  validateRequest(request: any, format: SupportedFormat): boolean;
  validateResponse(response: any, format: SupportedFormat): boolean;
}

export class UnifiedFormatConverter {
  private converters: Map<string, FormatConverter> = new Map();
  private streamingManager: StreamingManager;
  private protocolSelector: ProtocolSelector;
  private initialized: boolean = false;

  constructor() {
    this.streamingManager = new StreamingManager();
    this.protocolSelector = new ProtocolSelector();
  }

  async initialize(config?: any): Promise<void> {
    await this.streamingManager.initialize();
    
    if (config?.protocolSelector) {
      await this.protocolSelector.initialize(config.protocolSelector);
    }
    
    this.initialized = true;
    console.log('✅ Enhanced UnifiedFormatConverter initialized');
  }

  registerConverter(converter: FormatConverter): void {
    if (!this.initialized) {
      throw new Error('UnifiedFormatConverter not initialized');
    }

    this.converters.set(converter.name, converter);
    console.log(`✅ Format converter '${converter.name}' registered`);
  }

  async convertRequest(
    request: AIRequest, 
    sourceFormat: SupportedFormat, 
    targetFormat: SupportedFormat,
    protocolDecision?: ProtocolDecision
  ): Promise<any> {
    if (sourceFormat === targetFormat) {
      return request; // No conversion needed
    }

    console.log(`🔄 Converting request: ${sourceFormat} → ${targetFormat}`);

    // Apply protocol-driven preprocessing if available
    let preprocessedRequest = request;
    if (protocolDecision?.preprocessorConfig) {
      preprocessedRequest = await this.applyPreprocessing(request, protocolDecision.preprocessorConfig);
    }

    // First convert to standard format if not already
    let standardRequest = preprocessedRequest;
    if (sourceFormat !== 'standard') {
      standardRequest = await this.convertToStandard(preprocessedRequest, sourceFormat);
    }

    // Then convert from standard to target format
    if (targetFormat === 'standard') {
      return standardRequest;
    }

    const convertedRequest = await this.convertFromStandard(standardRequest, targetFormat);

    // Apply format-specific optimizations
    return this.applyFormatOptimizations(convertedRequest, targetFormat, protocolDecision);
  }

  async convertResponse(
    response: any, 
    sourceFormat: SupportedFormat, 
    targetFormat: SupportedFormat = 'standard',
    streamingConfig?: StreamingConfig,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<AIResponse> {
    if (sourceFormat === targetFormat && targetFormat === 'standard') {
      return response as AIResponse;
    }

    console.log(`🔄 Converting response: ${sourceFormat} → ${targetFormat}`);

    // Handle streaming responses with intelligent buffering
    if (streamingConfig && this.isStreamingResponse(response)) {
      const requestId = `conv-${Date.now()}`;
      const context = this.streamingManager.createStreamingContext(
        requestId,
        sourceFormat,
        sourceFormat,
        streamingConfig
      );

      try {
        const streamedResponse = await this.streamingManager.processStreamingResponse(
          response,
          context,
          onChunk
        );
        
        return await this.convertResponseToStandard(streamedResponse, sourceFormat);
      } finally {
        this.streamingManager.cleanupContext(requestId);
      }
    }

    // Convert from source format to standard format
    return await this.convertResponseToStandard(response, sourceFormat);
  }

  private async convertToStandard(request: any, sourceFormat: SupportedFormat): Promise<AIRequest> {
    switch (sourceFormat) {
      case 'anthropic':
        return this.convertAnthropicToStandard(request);
      case 'openai':
        return this.convertOpenAIToStandard(request);
      case 'gemini':
        return this.convertGeminiToStandard(request);
      case 'codewhisperer':
        return this.convertCodeWhispererToStandard(request);
      default:
        throw new Error(`Unsupported source format: ${sourceFormat}`);
    }
  }

  private async convertFromStandard(request: AIRequest, targetFormat: SupportedFormat): Promise<any> {
    switch (targetFormat) {
      case 'anthropic':
        return this.convertStandardToAnthropic(request);
      case 'openai':
        return this.convertStandardToOpenAI(request);
      case 'gemini':
        return this.convertStandardToGemini(request);
      case 'codewhisperer':
        return this.convertStandardToCodeWhisperer(request);
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }

  private async convertResponseToStandard(response: any, sourceFormat: SupportedFormat): Promise<AIResponse> {
    switch (sourceFormat) {
      case 'anthropic':
        return this.convertAnthropicResponseToStandard(response);
      case 'openai':
        return this.convertOpenAIResponseToStandard(response);
      case 'gemini':
        return this.convertGeminiResponseToStandard(response);
      case 'codewhisperer':
        return this.convertCodeWhispererResponseToStandard(response);
      case 'standard':
        return response as AIResponse;
      default:
        throw new Error(`Unsupported source format: ${sourceFormat}`);
    }
  }

  // Anthropic conversions
  private convertAnthropicToStandard(request: any): AIRequest {
    return {
      id: request.id || `anthropic-${Date.now()}`,
      provider: 'anthropic',
      model: request.model,
      messages: request.messages.map((msg: any) => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : this.extractTextFromContent(msg.content)
      })),
      tools: request.tools?.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      })),
      stream: request.stream,
      metadata: {
        timestamp: new Date(),
        source: 'anthropic',
        priority: 1
      }
    };
  }

  private convertStandardToAnthropic(request: AIRequest): any {
    const anthropicRequest: any = {
      model: request.model,
      messages: Array.isArray(request.messages) ? request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })) : [],
      max_tokens: this.getMaxTokensForModel(request.model, 'anthropic'),
      stream: request.stream || false
    };

    if (request.tools && request.tools.length > 0) {
      anthropicRequest.tools = request.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties: tool.parameters?.properties || {},
          required: tool.parameters?.required || []
        }
      }));
    }

    return anthropicRequest;
  }

  private convertAnthropicResponseToStandard(response: any): AIResponse {
    return {
      id: response.id,
      model: response.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: this.extractTextFromContent(response.content),
          metadata: {
            toolCalls: this.extractToolCallsFromContent(response.content)
          }
        },
        finishReason: this.mapAnthropicFinishReason(response.stop_reason)
      }],
      usage: {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'anthropic'
      }
    };
  }

  // OpenAI conversions
  private convertOpenAIToStandard(request: any): AIRequest {
    return {
      id: request.id || `openai-${Date.now()}`,
      provider: 'openai',
      model: request.model,
      messages: request.messages,
      tools: request.tools?.map((tool: any) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      })),
      stream: request.stream,
      metadata: {
        timestamp: new Date(),
        source: 'openai',
        priority: 1
      }
    };
  }

  private convertStandardToOpenAI(request: AIRequest): any {
    const openaiRequest: any = {
      model: request.model,
      messages: request.messages,
      stream: request.stream || false,
      max_tokens: this.getMaxTokensForModel(request.model, 'openai')
    };

    if (request.tools && request.tools.length > 0) {
      openaiRequest.tools = request.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      openaiRequest.tool_choice = 'auto';
    }

    return openaiRequest;
  }

  private convertOpenAIResponseToStandard(response: any): AIResponse {
    return {
      id: response.id,
      model: response.model,
      choices: response.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content || '',
          metadata: {
            toolCalls: choice.message.tool_calls
          }
        },
        finishReason: choice.finish_reason
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'openai'
      }
    };
  }

  // Gemini conversions
  private convertGeminiToStandard(request: any): AIRequest {
    const messages = request.contents?.map((content: any) => ({
      role: content.role === 'model' ? 'assistant' : 'user',
      content: content.parts?.map((part: any) => part.text).join('') || ''
    })) || [];

    return {
      id: request.id || `gemini-${Date.now()}`,
      provider: 'gemini',
      model: request.model || 'gemini-pro',
      messages,
      tools: request.tools?.[0]?.functionDeclarations?.map((func: any) => ({
        name: func.name,
        description: func.description,
        parameters: func.parameters
      })),
      stream: false, // Gemini streaming handled differently
      metadata: {
        timestamp: new Date(),
        source: 'gemini',
        priority: 1
      }
    };
  }

  private convertStandardToGemini(request: AIRequest): any {
    const geminiRequest: any = {
      contents: request.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        maxOutputTokens: this.getMaxTokensForModel(request.model, 'gemini'),
        temperature: 0.7,
        topP: 0.8,
        topK: 40
      }
    };

    if (request.tools && request.tools.length > 0) {
      geminiRequest.tools = [{
        functionDeclarations: request.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }];
    }

    return geminiRequest;
  }

  private convertGeminiResponseToStandard(response: any): AIResponse {
    const text = response.text ? response.text() : 
                 response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      id: `gemini-${Date.now()}`,
      model: 'gemini-pro',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: text
        },
        finishReason: this.mapGeminiFinishReason(response.candidates?.[0]?.finishReason)
      }],
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'gemini'
      }
    };
  }

  // CodeWhisperer conversions
  private convertCodeWhispererToStandard(request: any): AIRequest {
    return {
      id: request.id || `codewhisperer-${Date.now()}`,
      provider: 'codewhisperer',
      model: 'amazon.codewhisperer-v1',
      messages: [{
        role: 'user',
        content: request.fileContext?.leftFileContent || request.prompt || ''
      }],
      metadata: {
        timestamp: new Date(),
        source: 'codewhisperer',
        priority: 1,
        language: request.fileContext?.programmingLanguage?.languageName,
        filename: request.fileContext?.filename
      }
    };
  }

  private convertStandardToCodeWhisperer(request: AIRequest): any {
    const lastMessage = request.messages[request.messages.length - 1];
    const language = request.metadata?.language || 'javascript';
    const filename = request.metadata?.filename || `untitled.${this.getFileExtension(language)}`;

    return {
      fileContext: {
        filename,
        programmingLanguage: {
          languageName: language
        },
        leftFileContent: lastMessage?.content || '',
        rightFileContent: ''
      },
      maxResults: 5
    };
  }

  private convertCodeWhispererResponseToStandard(response: any): AIResponse {
    const completions = response.completions || [];
    const content = completions.map((comp: any) => comp.content).join('\n\n');

    return {
      id: `codewhisperer-${Date.now()}`,
      model: 'amazon.codewhisperer-v1',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content
        },
        finishReason: 'stop'
      }],
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'codewhisperer'
      }
    };
  }

  // Helper methods
  private extractTextFromContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');
    }
    
    return String(content);
  }

  private extractToolCallsFromContent(content: any): any[] {
    if (!Array.isArray(content)) {
      return [];
    }

    return content
      .filter(item => item.type === 'tool_use')
      .map(item => ({
        id: item.id,
        type: 'function',
        function: {
          name: item.name,
          arguments: JSON.stringify(item.input)
        }
      }));
  }

  private mapAnthropicFinishReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      'end_turn': 'stop',
      'max_tokens': 'length',
      'stop_sequence': 'stop',
      'tool_use': 'tool_calls'
    };
    return reasonMap[reason] || 'stop';
  }

  private mapGeminiFinishReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter'
    };
    return reasonMap[reason] || 'stop';
  }

  private getMaxTokensForModel(model: string, provider: string): number {
    const maxTokensMap: Record<string, Record<string, number>> = {
      anthropic: {
        'claude-3-5-sonnet-20241022': 8192,
        'claude-3-5-haiku-20241022': 8192,
        'claude-3-opus-20240229': 4096,
        'claude-3-sonnet-20240229': 4096,
        'claude-3-haiku-20240307': 4096
      },
      openai: {
        'gpt-4-turbo': 4096,
        'gpt-4': 4096,
        'gpt-3.5-turbo': 4096
      },
      gemini: {
        'gemini-1.5-pro': 8192,
        'gemini-1.5-flash': 8192,
        'gemini-pro': 8192,
        'gemini-pro-vision': 8192
      },
      codewhisperer: {
        'amazon.codewhisperer-v1': 4096,
        'amazon.codewhisperer-pro-v1': 8192
      }
    };

    return maxTokensMap[provider]?.[model] || 4096;
  }

  private getFileExtension(language: string): string {
    const extensionMap: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'csharp': 'cs',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'ruby': 'rb',
      'go': 'go',
      'rust': 'rs',
      'kotlin': 'kt',
      'scala': 'scala',
      'swift': 'swift'
    };
    
    return extensionMap[language] || 'txt';
  }

  // Validation methods
  validateRequest(request: any, format: SupportedFormat): boolean {
    switch (format) {
      case 'standard':
        return this.validateStandardRequest(request);
      case 'anthropic':
        return this.validateAnthropicRequest(request);
      case 'openai':
        return this.validateOpenAIRequest(request);
      case 'gemini':
        return this.validateGeminiRequest(request);
      case 'codewhisperer':
        return this.validateCodeWhispererRequest(request);
      default:
        return false;
    }
  }

  private validateStandardRequest(request: any): boolean {
    return !!(request.id && request.provider && request.model && request.messages);
  }

  private validateAnthropicRequest(request: any): boolean {
    return !!(request.model && request.messages && Array.isArray(request.messages));
  }

  private validateOpenAIRequest(request: any): boolean {
    return !!(request.model && request.messages && Array.isArray(request.messages));
  }

  private validateGeminiRequest(request: any): boolean {
    return !!(request.contents && Array.isArray(request.contents));
  }

  private validateCodeWhispererRequest(request: any): boolean {
    return !!(request.fileContext && request.fileContext.filename);
  }

  // Get supported formats
  getSupportedFormats(): SupportedFormat[] {
    return ['standard', 'anthropic', 'openai', 'gemini', 'codewhisperer'];
  }

  // Check if conversion is supported
  isConversionSupported(sourceFormat: SupportedFormat, targetFormat: SupportedFormat): boolean {
    const supportedFormats = this.getSupportedFormats();
    return supportedFormats.includes(sourceFormat) && supportedFormats.includes(targetFormat);
  }

  /**
   * Apply preprocessing rules based on protocol decision
   */
  private async applyPreprocessing(
    request: AIRequest,
    preprocessorConfig: any
  ): Promise<AIRequest> {
    let processedRequest = { ...request };

    for (const rule of preprocessorConfig.rules) {
      if (this.shouldApplyRule(rule, processedRequest)) {
        processedRequest = await this.applyPreprocessingRule(rule, processedRequest);
      }
    }

    return processedRequest;
  }

  /**
   * Check if preprocessing rule should be applied
   */
  private shouldApplyRule(rule: any, request: AIRequest): boolean {
    switch (rule.condition) {
      case 'always':
        return true;
      case 'has_tools':
        return !!(request.tools && request.tools.length > 0);
      case 'is_streaming':
        return !!request.stream;
      case 'missing_max_tokens':
        return !('max_tokens' in request);
      case 'has_messages':
        return !!(request.messages && request.messages.length > 0);
      default:
        return false;
    }
  }

  /**
   * Apply specific preprocessing rule
   */
  private async applyPreprocessingRule(rule: any, request: AIRequest): Promise<AIRequest> {
    const processedRequest = { ...request };

    switch (rule.action) {
      case 'map_model_name':
        processedRequest.model = this.mapModelName(request.model, rule.parameters.provider);
        break;

      case 'remove_unsupported_parameters':
        this.removeUnsupportedParameters(processedRequest, rule.parameters.provider);
        break;

      case 'add_max_tokens':
        if (!('max_tokens' in processedRequest)) {
          (processedRequest as any).max_tokens = rule.parameters.defaultValue;
        }
        break;

      case 'validate_anthropic_roles':
        this.validateAnthropicRoles(processedRequest);
        break;

      case 'convert_to_anthropic_tools':
        this.convertToAnthropicTools(processedRequest);
        break;

      case 'setup_openai_functions':
        this.setupOpenAIFunctions(processedRequest, rule.parameters);
        break;

      case 'format_gemini_contents':
        this.formatGeminiContents(processedRequest, rule.parameters);
        break;

      case 'extract_file_context':
        this.extractFileContext(processedRequest, rule.parameters);
        break;

      default:
        console.warn(`Unknown preprocessing action: ${rule.action}`);
    }

    return processedRequest;
  }

  /**
   * Map model names for provider compatibility
   */
  private mapModelName(model: string, provider: string): string {
    const modelMappings: Record<string, Record<string, string>> = {
      lmstudio: {
        'gpt-4': 'local-model',
        'gpt-3.5-turbo': 'local-model',
        'claude-3-sonnet': 'local-model'
      },
      ollama: {
        'gpt-4': 'llama2',
        'gpt-3.5-turbo': 'llama2:7b',
        'claude-3-sonnet': 'llama2:13b'
      }
    };

    return modelMappings[provider]?.[model] || model;
  }

  /**
   * Remove unsupported parameters for specific providers
   */
  private removeUnsupportedParameters(request: any, provider: string): void {
    const unsupportedParams: Record<string, string[]> = {
      lmstudio: ['tools', 'tool_choice', 'response_format'],
      ollama: ['tools', 'tool_choice', 'functions', 'function_call']
    };

    const paramsToRemove = unsupportedParams[provider] || [];
    for (const param of paramsToRemove) {
      delete request[param];
    }
  }

  /**
   * Validate Anthropic message roles
   */
  private validateAnthropicRoles(request: AIRequest): void {
    if (request.messages) {
      for (const message of request.messages) {
        if (!['user', 'assistant'].includes(message.role)) {
          console.warn(`Invalid Anthropic role: ${message.role}, converting to 'user'`);
          message.role = 'user';
        }
      }
    }
  }

  /**
   * Convert tools to Anthropic format
   */
  private convertToAnthropicTools(request: AIRequest): void {
    if (request.tools) {
      // Convert OpenAI-style tools to Anthropic format
      (request as any).tools = request.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties: tool.parameters.properties || {},
          required: tool.parameters.required || []
        }
      }));
    }
  }

  /**
   * Setup OpenAI function calling
   */
  private setupOpenAIFunctions(request: AIRequest, parameters: any): void {
    if (request.tools) {
      (request as any).tools = request.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      (request as any).tool_choice = parameters.toolChoice || 'auto';
    }
  }

  /**
   * Format contents for Gemini
   */
  private formatGeminiContents(request: AIRequest, parameters: any): void {
    if (request.messages) {
      (request as any).contents = request.messages.map(msg => ({
        role: parameters.roleMapping[msg.role] || msg.role,
        parts: [{ text: msg.content }]
      }));
      delete (request as any).messages;
    }
  }

  /**
   * Extract file context for CodeWhisperer
   */
  private extractFileContext(request: AIRequest, parameters: any): void {
    const lastMessage = request.messages?.[request.messages.length - 1];
    if (lastMessage) {
      (request as any).fileContext = {
        filename: request.metadata?.filename || 'untitled.js',
        programmingLanguage: {
          languageName: request.metadata?.language || 'javascript'
        },
        leftFileContent: lastMessage.content,
        rightFileContent: ''
      };
    }
  }

  /**
   * Apply format-specific optimizations
   */
  private applyFormatOptimizations(
    request: any,
    targetFormat: SupportedFormat,
    protocolDecision?: any
  ): any {
    const optimizedRequest = { ...request };

    switch (targetFormat) {
      case 'openai':
        // OpenAI-specific optimizations
        if (protocolDecision?.provider === 'lmstudio') {
          this.applyLMStudioOptimizations(optimizedRequest);
        } else if (protocolDecision?.provider === 'ollama') {
          this.applyOllamaOptimizations(optimizedRequest);
        }
        break;

      case 'anthropic':
        // Ensure max_tokens is present
        if (!optimizedRequest.max_tokens) {
          optimizedRequest.max_tokens = 4096;
        }
        break;

      case 'gemini':
        // Add generation config if missing
        if (!optimizedRequest.generationConfig) {
          optimizedRequest.generationConfig = {
            maxOutputTokens: 8192,
            temperature: 0.7,
            topP: 0.8,
            topK: 40
          };
        }
        break;
    }

    return optimizedRequest;
  }

  /**
   * Apply LMStudio-specific optimizations
   */
  private applyLMStudioOptimizations(request: any): void {
    // Adjust parameters for local model serving
    if (request.temperature === undefined) {
      request.temperature = 0.7;
    }
    if (request.max_tokens === undefined) {
      request.max_tokens = 2048;
    }
    // Remove unsupported parameters
    delete request.tools;
    delete request.tool_choice;
    delete request.response_format;
  }

  /**
   * Apply Ollama-specific optimizations
   */
  private applyOllamaOptimizations(request: any): void {
    // Format for Ollama compatibility
    if (request.messages) {
      // Ensure proper message formatting
      request.messages = request.messages.map((msg: any) => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }));
    }
    
    // Remove unsupported parameters
    delete request.tools;
    delete request.tool_choice;
    delete request.functions;
    delete request.function_call;
  }

  /**
   * Check if response is streaming
   */
  private isStreamingResponse(response: any): boolean {
    return !!(
      response[Symbol.asyncIterator] ||
      response.on ||
      response.pipe ||
      (typeof response === 'object' && response.stream)
    );
  }

  /**
   * Create protocol decision for conversion
   */
  async createProtocolDecision(
    request: AIRequest,
    routingContext: any
  ): Promise<any> {
    if (!this.protocolSelector) {
      return null;
    }

    try {
      return await this.protocolSelector.selectProtocol(request, routingContext);
    } catch (error) {
      console.warn('Failed to create protocol decision:', error);
      return null;
    }
  }

  /**
   * Get streaming manager
   */
  getStreamingManager(): StreamingManager {
    return this.streamingManager;
  }

  /**
   * Get protocol selector
   */
  getProtocolSelector(): ProtocolSelector {
    return this.protocolSelector;
  }

  async shutdown(): Promise<void> {
    this.converters.clear();
    await this.streamingManager.shutdown();
    await this.protocolSelector.shutdown();
    this.initialized = false;
    console.log('✅ Enhanced UnifiedFormatConverter shutdown completed');
  }
}

console.log('✅ UnifiedFormatConverter loaded');