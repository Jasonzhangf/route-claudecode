/**
 * Universal Pipeline Debug System for Claude Code Router
 * Specialized for Gemini Tool Calling Pipeline Debug & Analysis
 * 
 * Project owner: Jason Zhang
 * 
 * This system provides comprehensive debugging infrastructure for ANY pipeline type:
 * - API routing pipelines  
 * - Data processing pipelines
 * - CI/CD workflow pipelines
 * - Message queue pipelines
 * - Transformation pipelines
 * 
 * Core Features:
 * - Universal debug hook integration
 * - Hierarchical data capture & storage  
 * - Pipeline replay capabilities
 * - Comprehensive testing matrix generation
 * - Generic problem isolation framework
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

export interface PipelineStep {
  stepId: string;
  stepName: string;
  description: string;
  inputData?: any;
  outputData?: any;
  errorData?: any;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PipelineDebugSession {
  sessionId: string;
  pipelineType: 'gemini-tool-calling' | 'openai-tool-calling' | 'anthropic-processing' | 'data-transformation' | 'custom';
  testScriptName: string;
  startTime: number;
  endTime?: number;
  steps: PipelineStep[];
  summary?: PipelineDebugSummary;
}

export interface PipelineDebugSummary {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalDuration: number;
  failurePoint?: string;
  errorDetails?: any;
  dataCaptureSummary: DataCaptureSummary;
}

export interface DataCaptureSummary {
  inputDataSize: number;
  outputDataSize: number;
  intermediateDataCount: number;
  replayDataAvailable: boolean;
  storageLocation: string;
}

export interface TestMatrixEntry {
  testId: string;
  testName: string;
  pipelineType: string;
  inputVariations: any[];
  expectedOutputs: any[];
  testConditions: Record<string, any>;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export class UniversalPipelineDebugger {
  private debugDataDir: string;
  private currentSession?: PipelineDebugSession;
  private debugEnabled: boolean = false;

  constructor(debugDataDir: string = './debug-data') {
    this.debugDataDir = debugDataDir;
  }

  /**
   * Initialize debug session with --debug flag support
   * Non-intrusive: only activates when explicitly enabled
   */
  async initializeDebugSession(
    pipelineType: PipelineDebugSession['pipelineType'],
    testScriptName: string,
    enableDebug: boolean = process.argv.includes('--debug')
  ): Promise<string> {
    this.debugEnabled = enableDebug;
    
    if (!this.debugEnabled) {
      logger.debug('Pipeline debug disabled, running normal operation');
      return '';
    }

    const sessionId = `${pipelineType}-${testScriptName}-${Date.now()}`;
    
    this.currentSession = {
      sessionId,
      pipelineType,
      testScriptName,
      startTime: Date.now(),
      steps: []
    };

    // Create hierarchical storage directory
    const sessionDir = await this.createSessionDirectory(sessionId);
    
    logger.info('Universal Pipeline Debug Session Initialized', {
      sessionId,
      pipelineType,
      testScriptName,
      storageDir: sessionDir,
      debugEnabled: this.debugEnabled
    });

    return sessionId;
  }

  /**
   * Capture pipeline step data with complete input/output preservation
   * Works for ANY pipeline step type
   */
  async captureStepData(
    stepId: string,
    stepName: string,
    description: string,
    inputData: any,
    outputData?: any,
    errorData?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.debugEnabled || !this.currentSession) {
      return;
    }

    const stepStartTime = Date.now();
    
    const step: PipelineStep = {
      stepId,
      stepName,
      description,
      inputData: this.sanitizeData(inputData),
      outputData: this.sanitizeData(outputData),
      errorData: this.sanitizeData(errorData),
      timestamp: stepStartTime,
      metadata: metadata || {}
    };

    // Calculate duration if this is completion of a step
    const existingStepIndex = this.currentSession.steps.findIndex(s => s.stepId === stepId);
    if (existingStepIndex >= 0) {
      step.duration = stepStartTime - this.currentSession.steps[existingStepIndex].timestamp;
      this.currentSession.steps[existingStepIndex] = step;
    } else {
      this.currentSession.steps.push(step);
    }

    // Store step data to disk for replay capability
    await this.persistStepData(step);

    logger.debug('Pipeline step data captured', {
      sessionId: this.currentSession.sessionId,
      stepId,
      stepName,
      hasInputData: !!inputData,
      hasOutputData: !!outputData,
      hasErrorData: !!errorData,
      duration: step.duration
    });
  }

  /**
   * Generate comprehensive testing matrix for pipeline validation
   * Adapts to different pipeline types automatically
   */
  async generateTestingMatrix(pipelineType: string, currentRules?: any[]): Promise<TestMatrixEntry[]> {
    const testMatrix: TestMatrixEntry[] = [];

    switch (pipelineType) {
      case 'gemini-tool-calling':
        testMatrix.push(...this.generateGeminiToolCallTestMatrix());
        break;
      case 'openai-tool-calling':  
        testMatrix.push(...this.generateOpenAIToolCallTestMatrix());
        break;
      case 'anthropic-processing':
        testMatrix.push(...this.generateAnthropicProcessingTestMatrix());
        break;
      default:
        testMatrix.push(...this.generateGenericPipelineTestMatrix(pipelineType, currentRules));
    }

    // Save test matrix to disk
    await this.saveTestMatrix(pipelineType, testMatrix);

    logger.info('Testing matrix generated', {
      pipelineType,
      totalTests: testMatrix.length,
      criticalTests: testMatrix.filter(t => t.priority === 'critical').length,
      highPriorityTests: testMatrix.filter(t => t.priority === 'high').length
    });

    return testMatrix;
  }

  /**
   * Create pipeline replay mechanism for any captured data
   * Enables precise problem reproduction
   */
  async replayPipelineStep(
    stepId: string,
    sessionId?: string,
    modifiedInput?: any
  ): Promise<any> {
    const targetSessionId = sessionId || this.currentSession?.sessionId;
    if (!targetSessionId) {
      throw new Error('No session available for replay');
    }

    const stepData = await this.loadStepData(targetSessionId, stepId);
    if (!stepData) {
      throw new Error(`Step data not found: ${stepId}`);
    }

    logger.info('Replaying pipeline step', {
      sessionId: targetSessionId,
      stepId: stepData.stepId,
      stepName: stepData.stepName,
      usingModifiedInput: !!modifiedInput
    });

    // Use modified input if provided, otherwise use original
    const replayInput = modifiedInput || stepData.inputData;
    
    // Return the input data for replay by the calling system
    return {
      stepData,
      replayInput,
      originalOutput: stepData.outputData,
      metadata: stepData.metadata
    };
  }

  /**
   * Analyze pipeline for problem isolation
   * Generic framework that works across pipeline types
   */
  async analyzePipelineProblems(sessionId?: string): Promise<{
    problemNodes: string[];
    recommendedTests: string[];
    isolationStrategy: string;
    nextSteps: string[];
  }> {
    const targetSessionId = sessionId || this.currentSession?.sessionId;
    if (!targetSessionId) {
      throw new Error('No session available for analysis');
    }

    const session = await this.loadSession(targetSessionId);
    if (!session) {
      throw new Error(`Session not found: ${targetSessionId}`);
    }

    const problemNodes: string[] = [];
    const recommendedTests: string[] = [];
    const nextSteps: string[] = [];

    // Identify failing nodes
    for (const step of session.steps) {
      if (step.errorData || !step.outputData) {
        problemNodes.push(step.stepId);
      }
    }

    // Determine isolation strategy based on pipeline type and failures
    let isolationStrategy = 'sequential-step-isolation';
    
    if (problemNodes.length === 0) {
      isolationStrategy = 'output-validation-focused';
      nextSteps.push('verify-output-format-compliance');
      nextSteps.push('check-downstream-processing');
    } else if (problemNodes.length === 1) {
      isolationStrategy = 'single-node-deep-analysis';
      recommendedTests.push(`test-step-${problemNodes[0]}-isolated`);
      nextSteps.push(`debug-${problemNodes[0]}-input-validation`);
      nextSteps.push(`debug-${problemNodes[0]}-processing-logic`);
    } else {
      isolationStrategy = 'multi-node-dependency-analysis';
      recommendedTests.push('test-pipeline-dependencies');
      nextSteps.push('map-inter-step-dependencies');
      nextSteps.push('test-individual-steps-isolation');
    }

    logger.info('Pipeline problem analysis completed', {
      sessionId: targetSessionId,
      problemNodesCount: problemNodes.length,
      isolationStrategy,
      recommendedTestsCount: recommendedTests.length
    });

    return {
      problemNodes,
      recommendedTests,
      isolationStrategy,
      nextSteps
    };
  }

  /**
   * Complete debug session and generate comprehensive summary
   */
  async completeSession(): Promise<PipelineDebugSummary | null> {
    if (!this.currentSession || !this.debugEnabled) {
      return null;
    }

    this.currentSession.endTime = Date.now();

    const summary: PipelineDebugSummary = {
      totalSteps: this.currentSession.steps.length,
      successfulSteps: this.currentSession.steps.filter(s => !s.errorData && s.outputData).length,
      failedSteps: this.currentSession.steps.filter(s => s.errorData || !s.outputData).length,
      totalDuration: this.currentSession.endTime - this.currentSession.startTime,
      dataCaptureSummary: {
        inputDataSize: this.calculateTotalDataSize(this.currentSession.steps, 'inputData'),
        outputDataSize: this.calculateTotalDataSize(this.currentSession.steps, 'outputData'),
        intermediateDataCount: this.currentSession.steps.length,
        replayDataAvailable: true,
        storageLocation: await this.getSessionDirectory(this.currentSession.sessionId)
      }
    };

    // Identify failure point
    const failedStep = this.currentSession.steps.find(s => s.errorData);
    if (failedStep) {
      summary.failurePoint = failedStep.stepId;
      summary.errorDetails = failedStep.errorData;
    }

    this.currentSession.summary = summary;

    // Persist complete session
    await this.saveSession(this.currentSession);

    logger.info('Pipeline debug session completed', {
      sessionId: this.currentSession.sessionId,
      ...summary
    });

    return summary;
  }

  // Private helper methods

  private generateGeminiToolCallTestMatrix(): TestMatrixEntry[] {
    return [
      {
        testId: 'gemini-anthropic-format-tools',
        testName: 'Gemini工具调用-Anthropic格式工具定义',
        pipelineType: 'gemini-tool-calling',
        inputVariations: [
          { toolFormat: 'anthropic', toolCount: 1, toolType: 'simple' },
          { toolFormat: 'anthropic', toolCount: 2, toolType: 'complex' },
          { toolFormat: 'anthropic', toolCount: 1, toolType: 'nested-schema' }
        ],
        expectedOutputs: [
          { hasToolConfig: true, toolConfigMode: 'AUTO', hasAllowedFunctionNames: true },
          { stopReason: 'tool_use', contentType: 'tool_use' }
        ],
        testConditions: { model: 'gemini-2.5-flash', temperature: 0.1 },
        priority: 'critical'
      },
      {
        testId: 'gemini-openai-format-tools',  
        testName: 'Gemini工具调用-OpenAI格式工具定义',
        pipelineType: 'gemini-tool-calling',
        inputVariations: [
          { toolFormat: 'openai', toolCount: 1, toolType: 'function' },
          { toolFormat: 'openai', toolCount: 2, toolType: 'mixed' }
        ],
        expectedOutputs: [
          { hasToolConfig: true, toolConfigMode: 'AUTO', hasAllowedFunctionNames: true },
          { stopReason: 'tool_use', contentType: 'tool_use' }
        ],
        testConditions: { model: 'gemini-2.5-pro', temperature: 0 },
        priority: 'critical'
      },
      {
        testId: 'gemini-tool-config-modes',
        testName: 'Gemini工具配置模式测试',
        pipelineType: 'gemini-tool-calling', 
        inputVariations: [
          { toolConfigMode: 'AUTO' },
          { toolConfigMode: 'ANY' },
          { toolConfigMode: 'NONE' }
        ],
        expectedOutputs: [
          { toolBehavior: 'conditional' },
          { toolBehavior: 'forced' },
          { toolBehavior: 'disabled' }
        ],
        testConditions: { model: 'gemini-2.5-flash' },
        priority: 'high'
      }
    ];
  }

  private generateOpenAIToolCallTestMatrix(): TestMatrixEntry[] {
    return [
      {
        testId: 'openai-tool-choice-auto',
        testName: 'OpenAI工具调用-自动选择模式',
        pipelineType: 'openai-tool-calling',
        inputVariations: [
          { toolChoice: 'auto', toolCount: 1 },
          { toolChoice: 'auto', toolCount: 3 }
        ],
        expectedOutputs: [
          { finishReason: 'tool_calls', hasToolCalls: true }
        ],
        testConditions: { model: 'gpt-4' },
        priority: 'critical'
      }
    ];
  }

  private generateAnthropicProcessingTestMatrix(): TestMatrixEntry[] {
    return [
      {
        testId: 'anthropic-tool-use-processing',
        testName: 'Anthropic工具使用处理',
        pipelineType: 'anthropic-processing', 
        inputVariations: [
          { contentType: 'tool_use', toolCount: 1 },
          { contentType: 'tool_use', toolCount: 2 }
        ],
        expectedOutputs: [
          { stopReason: 'tool_use', hasContent: true }
        ],
        testConditions: { model: 'claude-3-5-sonnet-20241022' },
        priority: 'high'
      }
    ];
  }

  private generateGenericPipelineTestMatrix(pipelineType: string, rules?: any[]): TestMatrixEntry[] {
    return [
      {
        testId: `${pipelineType}-basic-flow`,
        testName: `${pipelineType}基础流程测试`,
        pipelineType,
        inputVariations: [{ basicInput: true }],
        expectedOutputs: [{ basicOutput: true }],
        testConditions: {},
        priority: 'high'
      }
    ];
  }

  private async createSessionDirectory(sessionId: string): Promise<string> {
    const sessionDir = path.join(this.debugDataDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    
    // Create subdirectories for organized storage
    await fs.mkdir(path.join(sessionDir, 'steps'), { recursive: true });
    await fs.mkdir(path.join(sessionDir, 'replay'), { recursive: true });
    await fs.mkdir(path.join(sessionDir, 'analysis'), { recursive: true });
    
    return sessionDir;
  }

  private async getSessionDirectory(sessionId: string): Promise<string> {
    return path.join(this.debugDataDir, sessionId);
  }

  private async persistStepData(step: PipelineStep): Promise<void> {
    if (!this.currentSession) return;
    
    const stepFile = path.join(
      this.debugDataDir,
      this.currentSession.sessionId,
      'steps',
      `${step.stepId}.json`
    );
    
    await fs.writeFile(stepFile, JSON.stringify(step, null, 2));
  }

  private async loadStepData(sessionId: string, stepId: string): Promise<PipelineStep | null> {
    try {
      const stepFile = path.join(this.debugDataDir, sessionId, 'steps', `${stepId}.json`);
      const data = await fs.readFile(stepFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to load step data', { sessionId, stepId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private async saveSession(session: PipelineDebugSession): Promise<void> {
    const sessionFile = path.join(this.debugDataDir, session.sessionId, 'session.json');
    await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
  }

  private async loadSession(sessionId: string): Promise<PipelineDebugSession | null> {
    try {
      const sessionFile = path.join(this.debugDataDir, sessionId, 'session.json');
      const data = await fs.readFile(sessionFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to load session', { sessionId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private async saveTestMatrix(pipelineType: string, testMatrix: TestMatrixEntry[]): Promise<void> {
    const matrixFile = path.join(this.debugDataDir, `test-matrix-${pipelineType}-${Date.now()}.json`);
    await fs.writeFile(matrixFile, JSON.stringify(testMatrix, null, 2));
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // Remove sensitive information
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove API keys and other sensitive data
    this.removeSensitiveFields(sanitized);
    
    return sanitized;
  }

  private removeSensitiveFields(obj: any, visited = new Set()): void {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);
    
    const sensitiveKeys = ['apiKey', 'api_key', 'token', 'password', 'secret', 'auth'];
    
    for (const key in obj) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key], visited);
      }
    }
  }

  private calculateTotalDataSize(steps: PipelineStep[], field: keyof PipelineStep): number {
    return steps.reduce((total, step) => {
      const data = step[field];
      if (data) {
        return total + JSON.stringify(data).length;
      }
      return total;
    }, 0);
  }
}

// Export debug wrapper functions for easy integration
// export function createDebugHook(pipelineType: string, stepId: string) {
//   return async (debugger: UniversalPipelineDebugger, inputData: any, outputData?: any, errorData?: any): Promise<void> => {
//     await debugger.captureStepData(
//       stepId,
//       `${pipelineType}-${stepId}`,
//       `Debug hook for ${stepId}`,
//       inputData,
//       outputData,
//       errorData
//     );
//   };
// }

export default UniversalPipelineDebugger;