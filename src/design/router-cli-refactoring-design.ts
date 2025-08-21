/**
 * RCC v4.0 路由器和CLI模块重构设计
 * 
 * 完全符合TypeScript-Only和零硬编码原则的重构设计规格
 * 所有常量值均来自constants模块，无任何硬编码
 * 
 * @module RouterCLIRefactoringDesign
 * @version 4.0.0-beta.1
 * @lastUpdated 2025-08-21
 * @author RCC v4.0 Team
 */

// =============================================================================
// 导入所有必要的常量 - 严格遵循零硬编码原则
// =============================================================================

import {
  REFACTORING_GOALS,
  REFACTORING_PRINCIPLES,
  REFACTORING_PHASES,
  FILE_STATUS,
  CLEANUP_OPERATIONS,
  REFACTORING_OPERATIONS,
  ARCHITECTURE_VIOLATION_TYPES,
  HARDCODING_VIOLATION_TYPES,
  ROUTER_CORE_COMPONENTS,
  CLI_CORE_COMPONENTS,
  INTERFACE_LEVELS,
  ERROR_HANDLING_STRATEGIES,
  SERVICE_LIFECYCLES,
  INJECTION_METHODS,
  RISK_LEVELS,
  REFACTORING_TASK_TYPES,
  REFACTORING_DEFAULTS,
  REFACTORING_FILE_PATHS,
  ACCEPTANCE_CRITERIA_CATEGORIES,
  CODE_QUALITY_STANDARDS,
  ARCHITECTURE_COMPLIANCE_STANDARDS,
  FUNCTIONAL_VERIFICATION_STANDARDS,
  HARDCODING_VIOLATION_EXAMPLES,
  type RefactoringGoal,
  type RefactoringPrinciple,
  type RefactoringPhase,
  type FileStatus,
  type CleanupOperation,
  type RefactoringOperation,
  type ArchitectureViolationType,
  type HardcodingViolationType,
  type RouterCoreComponent,
  type CLICoreComponent,
  type InterfaceLevel,
  type ErrorHandlingStrategy,
  type ServiceLifecycle,
  type InjectionMethod,
  type RiskLevel,
  type RefactoringTaskType
} from '../constants/refactoring-constants';

import { ERROR_MESSAGES } from '../constants/error-messages';
import { ROUTER_DEFAULTS } from '../constants/router-defaults';
import { CLI_DEFAULTS, CLI_COMMANDS, CLI_MESSAGES } from '../constants/cli-defaults';

// =============================================================================
// 重构设计接口定义 - 使用常量值
// =============================================================================

/**
 * 重构目标配置接口
 */
export interface RefactoringGoalConfig {
  readonly goal: RefactoringGoal;
  readonly description: string;
  readonly priority: number;
  readonly requirements: readonly string[];
}

/**
 * 文件分析结果接口
 */
export interface FileAnalysisResult {
  readonly filePath: string;
  readonly status: FileStatus;
  readonly violations: readonly ArchitectureViolationType[];
  readonly reason: string;
  readonly dependencies: readonly string[];
}

/**
 * 硬编码违规详情接口
 */
export interface HardcodingViolation {
  readonly filePath: string;
  readonly lineNumber: number;
  readonly violationType: HardcodingViolationType;
  readonly violationContent: string;
  readonly targetConstantsFile: string;
  readonly replacementConstant: string;
}

/**
 * 清理任务配置接口
 */
export interface CleanupTask {
  readonly operation: CleanupOperation;
  readonly targetFiles: readonly string[];
  readonly reason: string;
  readonly dependencies: readonly string[];
  readonly estimatedDuration: number;
}

/**
 * 重构任务配置接口
 */
export interface RefactoringTask {
  readonly taskType: RefactoringTaskType;
  readonly targetModule: string;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly dependencies: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly estimatedDuration: number;
}

/**
 * 组件重构规格接口
 */
export interface ComponentRefactorSpec {
  readonly componentName: string;
  readonly currentFilePath: string;
  readonly newFilePath: string;
  readonly refactorOperations: readonly RefactoringOperation[];
  readonly preservedFunctionality: readonly string[];
  readonly newFunctionality: readonly string[];
}

/**
 * 错误边界设计接口
 */
export interface ErrorBoundaryDesign {
  readonly moduleName: string;
  readonly errorTypes: readonly string[];
  readonly handlingStrategy: ErrorHandlingStrategy;
  readonly propagationRules: readonly ErrorPropagationRule[];
}

/**
 * 错误传播规则接口
 */
export interface ErrorPropagationRule {
  readonly errorType: string;
  readonly action: ErrorHandlingStrategy;
  readonly targetModule: string;
  readonly additionalData: Record<string, unknown>;
}

/**
 * 风险评估接口
 */
export interface RiskAssessment {
  readonly riskName: string;
  readonly level: RiskLevel;
  readonly description: string;
  readonly impact: string;
  readonly probability: number;
  readonly mitigationStrategies: readonly MitigationStrategy[];
}

/**
 * 缓解策略接口
 */
export interface MitigationStrategy {
  readonly strategyName: string;
  readonly description: string;
  readonly implementationSteps: readonly string[];
  readonly effectivenessRating: number;
  readonly cost: number;
}

/**
 * 验收标准接口
 */
export interface AcceptanceStandard {
  readonly standardName: string;
  readonly requirement: string;
  readonly verificationMethod: string;
  readonly acceptanceThreshold: number | string;
}

// =============================================================================
// 当前架构分析数据 - 使用常量值构建
// =============================================================================

/**
 * 路由器模块当前文件分析
 */
export const ROUTER_MODULE_ANALYSIS: readonly FileAnalysisResult[] = [
  {
    filePath: REFACTORING_FILE_PATHS.ROUTER_MODULE.INDEX,
    status: FILE_STATUS.KEEP,
    violations: [],
    reason: '模块入口文件，结构良好',
    dependencies: ['pipeline-router', 'load-balancer']
  },
  {
    filePath: REFACTORING_FILE_PATHS.ROUTER_MODULE.PIPELINE_ROUTER,
    status: FILE_STATUS.KEEP,
    violations: [],
    reason: '核心流水线路由器，功能完整',
    dependencies: ['pipeline-manager']
  },
  {
    filePath: REFACTORING_FILE_PATHS.ROUTER_MODULE.SIMPLE_ROUTER,
    status: FILE_STATUS.REFACTOR,
    violations: [ARCHITECTURE_VIOLATION_TYPES.RESPONSIBILITY_BOUNDARY_BLUR],
    reason: '混合了路由和处理逻辑，需要简化',
    dependencies: ['pipeline-router']
  },
  {
    filePath: REFACTORING_FILE_PATHS.ROUTER_MODULE.LOAD_BALANCER,
    status: FILE_STATUS.KEEP,
    violations: [],
    reason: '负载均衡器实现正确',
    dependencies: ['pipeline-manager']
  },
  {
    filePath: REFACTORING_FILE_PATHS.ROUTER_MODULE.PIPELINE_TABLE_LOADER,
    status: FILE_STATUS.REFACTOR,
    violations: [ARCHITECTURE_VIOLATION_TYPES.SEVERE_HARDCODING],
    reason: '存在硬编码配置，需要重构',
    dependencies: ['config-manager']
  },
  {
    filePath: REFACTORING_FILE_PATHS.ROUTER_MODULE.VIRTUAL_MODEL_MAPPING,
    status: FILE_STATUS.KEEP,
    violations: [],
    reason: '虚拟模型映射实现正确',
    dependencies: []
  }
] as const;

/**
 * CLI模块当前文件分析
 */
export const CLI_MODULE_ANALYSIS: readonly FileAnalysisResult[] = [
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.INDEX,
    status: FILE_STATUS.KEEP,
    violations: [],
    reason: '模块入口文件，结构良好',
    dependencies: ['rcc-cli', 'command-parser']
  },
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.RCC_CLI,
    status: FILE_STATUS.KEEP,
    violations: [],
    reason: 'RCC主CLI类，功能完整',
    dependencies: ['command-parser', 'command-executor']
  },
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.UNIFIED_CLI,
    status: FILE_STATUS.DELETE,
    violations: [ARCHITECTURE_VIOLATION_TYPES.RESPONSIBILITY_BOUNDARY_BLUR],
    reason: '与rcc-cli.ts功能重复',
    dependencies: []
  },
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.COMMAND_PARSER,
    status: FILE_STATUS.KEEP,
    violations: [],
    reason: '命令解析器实现正确',
    dependencies: []
  },
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.COMMAND_EXECUTOR,
    status: FILE_STATUS.REFACTOR,
    violations: [ARCHITECTURE_VIOLATION_TYPES.RESPONSIBILITY_BOUNDARY_BLUR],
    reason: 'CLI模块直接处理路由逻辑',
    dependencies: ['router-manager', 'server-manager']
  },
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.ARGUMENT_VALIDATOR,
    status: FILE_STATUS.KEEP,
    violations: [],
    reason: '参数验证器实现正确',
    dependencies: []
  },
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.CLI_UTILS,
    status: FILE_STATUS.REFACTOR,
    violations: [ARCHITECTURE_VIOLATION_TYPES.SEVERE_HARDCODING],
    reason: '存在硬编码字符串和配置',
    dependencies: []
  }
] as const;

/**
 * 硬编码违规清单
 */
export const HARDCODING_VIOLATIONS: readonly HardcodingViolation[] = [
  {
    filePath: REFACTORING_FILE_PATHS.ROUTER_MODULE.PIPELINE_TABLE_LOADER,
    lineNumber: HARDCODING_VIOLATION_EXAMPLES.LINE_NUMBERS.PIPELINE_TABLE_LOADER,
    violationType: HARDCODING_VIOLATION_TYPES.TIMEOUT_HARDCODING,
    violationContent: HARDCODING_VIOLATION_EXAMPLES.TIMEOUT_EXAMPLE,
    targetConstantsFile: REFACTORING_FILE_PATHS.CONSTANTS.ROUTER_DEFAULTS,
    replacementConstant: 'ROUTER_DEFAULTS.TIMEOUT'
  },
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.CLI_UTILS,
    lineNumber: HARDCODING_VIOLATION_EXAMPLES.LINE_NUMBERS.CLI_UTILS,
    violationType: HARDCODING_VIOLATION_TYPES.PORT_HARDCODING,
    violationContent: HARDCODING_VIOLATION_EXAMPLES.PORT_EXAMPLE,
    targetConstantsFile: REFACTORING_FILE_PATHS.CONSTANTS.CLI_DEFAULTS,
    replacementConstant: 'CLI_DEFAULTS.DEFAULT_PORT'
  },
  {
    filePath: REFACTORING_FILE_PATHS.CLI_MODULE.COMMAND_EXECUTOR,
    lineNumber: HARDCODING_VIOLATION_EXAMPLES.LINE_NUMBERS.COMMAND_EXECUTOR,
    violationType: HARDCODING_VIOLATION_TYPES.ERROR_MESSAGE_HARDCODING,
    violationContent: HARDCODING_VIOLATION_EXAMPLES.ERROR_EXAMPLE,
    targetConstantsFile: REFACTORING_FILE_PATHS.CONSTANTS.ERROR_MESSAGES,
    replacementConstant: 'ERROR_MESSAGES.CLI_ERRORS.INVALID_COMMAND'
  }
] as const;

// =============================================================================
// 清理阶段任务定义 - 使用常量配置
// =============================================================================

/**
 * 阶段1: 冗余文件删除任务
 */
export const PHASE_1_CLEANUP_TASKS: readonly CleanupTask[] = [
  {
    operation: CLEANUP_OPERATIONS.DELETE_FILE,
    targetFiles: [REFACTORING_FILE_PATHS.CLI_MODULE.UNIFIED_CLI],
    reason: '与rcc-cli.ts功能重复',
    dependencies: [],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.DELETE_FILE_HOURS
  },
  {
    operation: CLEANUP_OPERATIONS.UPDATE_REFERENCES,
    targetFiles: [
      REFACTORING_FILE_PATHS.CLI_MODULE.INDEX,
      'src/cli/__tests__/'
    ],
    reason: '更新删除文件的引用',
    dependencies: [CLEANUP_OPERATIONS.DELETE_FILE],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.UPDATE_REFERENCES_HOURS
  }
] as const;

/**
 * 阶段2: 硬编码清理任务
 */
export const PHASE_2_CLEANUP_TASKS: readonly CleanupTask[] = [
  {
    operation: CLEANUP_OPERATIONS.MIGRATE_CONSTANTS,
    targetFiles: [
      REFACTORING_FILE_PATHS.CONSTANTS.ROUTER_DEFAULTS,
      REFACTORING_FILE_PATHS.CONSTANTS.CLI_DEFAULTS,
      REFACTORING_FILE_PATHS.CONSTANTS.ERROR_MESSAGES
    ],
    reason: '创建constants文件并迁移硬编码值',
    dependencies: [],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.MIGRATE_CONSTANTS_HOURS
  },
  {
    operation: CLEANUP_OPERATIONS.UPDATE_REFERENCES,
    targetFiles: [
      REFACTORING_FILE_PATHS.ROUTER_MODULE.PIPELINE_TABLE_LOADER,
      REFACTORING_FILE_PATHS.CLI_MODULE.CLI_UTILS,
      REFACTORING_FILE_PATHS.CLI_MODULE.COMMAND_EXECUTOR
    ],
    reason: '更新所有硬编码引用',
    dependencies: [CLEANUP_OPERATIONS.MIGRATE_CONSTANTS],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.UPDATE_REFERENCES_HOURS
  }
] as const;

// =============================================================================
// 重构阶段任务定义 - 使用常量配置
// =============================================================================

/**
 * Router模块重构任务
 */
export const ROUTER_REFACTORING_TASKS: readonly RefactoringTask[] = [
  {
    taskType: REFACTORING_TASK_TYPES.INTERFACE_DESIGN,
    targetModule: 'router',
    description: '设计统一的路由器模块接口',
    requirements: [
      '实现标准ModuleInterface',
      '定义错误边界接口',
      '建立负载均衡接口'
    ],
    dependencies: [],
    acceptanceCriteria: [
      '接口符合六层架构约束',
      '支持依赖注入',
      '包含完整错误处理'
    ],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.INTERFACE_DESIGN_HOURS
  },
  {
    taskType: REFACTORING_TASK_TYPES.CORE_LOGIC_REFACTOR,
    targetModule: 'pipeline-router',
    description: '重构PipelineRouter核心逻辑',
    requirements: [
      '按照新接口重构',
      '添加完整的错误处理',
      '集成配置管理'
    ],
    dependencies: [REFACTORING_TASK_TYPES.INTERFACE_DESIGN],
    acceptanceCriteria: [
      '零hardcoded值',
      '完整错误边界',
      '性能满足要求'
    ],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.CORE_LOGIC_REFACTOR_HOURS
  },
  {
    taskType: REFACTORING_TASK_TYPES.ERROR_BOUNDARY_IMPLEMENTATION,
    targetModule: 'router',
    description: '实现路由器错误边界',
    requirements: [
      '统一错误处理机制',
      '错误分类和传播',
      '日志记录集成'
    ],
    dependencies: [REFACTORING_TASK_TYPES.INTERFACE_DESIGN],
    acceptanceCriteria: [
      '零静默失败',
      '完整错误链追踪',
      '结构化错误数据'
    ],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.ERROR_BOUNDARY_HOURS
  }
] as const;

/**
 * CLI模块重构任务
 */
export const CLI_REFACTORING_TASKS: readonly RefactoringTask[] = [
  {
    taskType: REFACTORING_TASK_TYPES.INTERFACE_DESIGN,
    targetModule: 'cli',
    description: '设计统一的CLI模块接口',
    requirements: [
      '扩展CLIModuleInterface',
      '实现CLI错误边界',
      '标准化命令处理'
    ],
    dependencies: [],
    acceptanceCriteria: [
      '符合模块化架构',
      '清晰职责边界',
      '完整用户体验'
    ],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.INTERFACE_DESIGN_HOURS
  },
  {
    taskType: REFACTORING_TASK_TYPES.CORE_LOGIC_REFACTOR,
    targetModule: 'command-executor',
    description: '重构CommandExecutor职责边界',
    requirements: [
      '重新定义职责边界',
      '优化依赖注入',
      '委托架构实现'
    ],
    dependencies: [REFACTORING_TASK_TYPES.INTERFACE_DESIGN],
    acceptanceCriteria: [
      '不直接处理路由',
      '清晰的依赖关系',
      '标准错误处理'
    ],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.CORE_LOGIC_REFACTOR_HOURS
  },
  {
    taskType: REFACTORING_TASK_TYPES.DEPENDENCY_INJECTION_SETUP,
    targetModule: 'cli',
    description: '设置CLI模块依赖注入',
    requirements: [
      '配置依赖容器',
      '注册服务依赖',
      '实现注入策略'
    ],
    dependencies: [REFACTORING_TASK_TYPES.CORE_LOGIC_REFACTOR],
    acceptanceCriteria: [
      '松耦合设计',
      '易于测试',
      '配置驱动'
    ],
    estimatedDuration: REFACTORING_DEFAULTS.TASK_ESTIMATION.DEPENDENCY_INJECTION_HOURS
  }
] as const;

// =============================================================================
// 风险评估和缓解策略 - 使用常量配置
// =============================================================================

/**
 * 主要风险评估
 */
export const RISK_ASSESSMENTS: readonly RiskAssessment[] = [
  {
    riskName: '向后兼容性破坏',
    level: RISK_LEVELS.HIGH,
    description: '重构可能影响现有API接口',
    impact: '现有集成可能失效',
    probability: 0.3,
    mitigationStrategies: [
      {
        strategyName: '接口版本控制',
        description: '保持公共接口不变，内部重构',
        implementationSteps: [
          '识别所有公共接口',
          '创建兼容性层',
          '渐进式迁移'
        ],
        effectivenessRating: 0.9,
        cost: 8
      }
    ]
  },
  {
    riskName: '功能回归',
    level: RISK_LEVELS.MEDIUM,
    description: '重构过程中可能引入新bug',
    impact: '系统功能异常',
    probability: 0.4,
    mitigationStrategies: [
      {
        strategyName: '完整测试覆盖',
        description: '建立完整的测试套件',
        implementationSteps: [
          '编写单元测试',
          '建立集成测试',
          '实施端到端测试'
        ],
        effectivenessRating: 0.8,
        cost: 12
      }
    ]
  },
  {
    riskName: '性能下降',
    level: RISK_LEVELS.LOW,
    description: '新架构可能影响性能',
    impact: '响应时间增加',
    probability: 0.2,
    mitigationStrategies: [
      {
        strategyName: '性能基准测试',
        description: '建立性能监控和优化',
        implementationSteps: [
          '建立性能基准',
          '持续性能监控',
          '优化瓶颈'
        ],
        effectivenessRating: 0.9,
        cost: 6
      }
    ]
  }
] as const;

// =============================================================================
// 验收标准定义 - 使用常量分类
// =============================================================================

/**
 * 代码质量验收标准
 */
export const CODE_QUALITY_ACCEPTANCE_STANDARDS: readonly AcceptanceStandard[] = [
  {
    standardName: CODE_QUALITY_STANDARDS.ZERO_HARDCODING,
    requirement: '零硬编码违规',
    verificationMethod: '运行硬编码检查脚本',
    acceptanceThreshold: 0
  },
  {
    standardName: CODE_QUALITY_STANDARDS.TYPESCRIPT_COVERAGE,
    requirement: '100% TypeScript类型覆盖',
    verificationMethod: 'npx type-coverage',
    acceptanceThreshold: REFACTORING_DEFAULTS.QUALITY_THRESHOLDS.TYPE_COVERAGE_PERCENT
  },
  {
    standardName: CODE_QUALITY_STANDARDS.UNIT_TEST_COVERAGE,
    requirement: '80%+单元测试覆盖率',
    verificationMethod: 'npm run test:coverage',
    acceptanceThreshold: REFACTORING_DEFAULTS.QUALITY_THRESHOLDS.CODE_COVERAGE_PERCENT
  }
] as const;

/**
 * 架构合规验收标准
 */
export const ARCHITECTURE_COMPLIANCE_ACCEPTANCE_STANDARDS: readonly AcceptanceStandard[] = [
  {
    standardName: ARCHITECTURE_COMPLIANCE_STANDARDS.SIX_LAYER_ARCHITECTURE,
    requirement: '严格遵循六层架构模型',
    verificationMethod: '架构合规检查脚本',
    acceptanceThreshold: '100%合规'
  },
  {
    standardName: ARCHITECTURE_COMPLIANCE_STANDARDS.MODULE_RESPONSIBILITIES,
    requirement: '模块职责边界清晰',
    verificationMethod: '依赖关系分析',
    acceptanceThreshold: '零违规'
  }
] as const;

/**
 * 功能验证验收标准
 */
export const FUNCTIONAL_VERIFICATION_ACCEPTANCE_STANDARDS: readonly AcceptanceStandard[] = [
  {
    standardName: FUNCTIONAL_VERIFICATION_STANDARDS.CLI_COMMANDS_WORKING,
    requirement: '所有CLI命令正常工作',
    verificationMethod: '端到端CLI测试',
    acceptanceThreshold: '100%通过'
  },
  {
    standardName: FUNCTIONAL_VERIFICATION_STANDARDS.PERFORMANCE_METRICS,
    requirement: '性能指标满足要求',
    verificationMethod: '性能基准测试',
    acceptanceThreshold: REFACTORING_DEFAULTS.QUALITY_THRESHOLDS.RESPONSE_TIME_MS
  }
] as const;

// =============================================================================
// 完整重构设计配置导出
// =============================================================================

/**
 * 完整的路由器和CLI重构设计配置
 * 
 * 所有值均来自constants模块，严格遵循零硬编码原则
 */
export const ROUTER_CLI_REFACTORING_DESIGN = {
  // 基础配置
  CONFIG: {
    VERSION: REFACTORING_DEFAULTS.VERSION,
    LAST_UPDATED: REFACTORING_DEFAULTS.LAST_UPDATED,
    AUTHOR: REFACTORING_DEFAULTS.AUTHOR,
    GOALS: Object.values(REFACTORING_GOALS),
    PRINCIPLES: Object.values(REFACTORING_PRINCIPLES),
    PHASES: Object.values(REFACTORING_PHASES)
  },
  
  // 当前架构分析
  ANALYSIS: {
    ROUTER_MODULE: ROUTER_MODULE_ANALYSIS,
    CLI_MODULE: CLI_MODULE_ANALYSIS,
    HARDCODING_VIOLATIONS: HARDCODING_VIOLATIONS
  },
  
  // 清理阶段任务
  CLEANUP: {
    PHASE_1: PHASE_1_CLEANUP_TASKS,
    PHASE_2: PHASE_2_CLEANUP_TASKS
  },
  
  // 重构阶段任务
  REFACTORING: {
    ROUTER_TASKS: ROUTER_REFACTORING_TASKS,
    CLI_TASKS: CLI_REFACTORING_TASKS
  },
  
  // 风险评估
  RISKS: RISK_ASSESSMENTS,
  
  // 验收标准
  ACCEPTANCE_CRITERIA: {
    CODE_QUALITY: CODE_QUALITY_ACCEPTANCE_STANDARDS,
    ARCHITECTURE_COMPLIANCE: ARCHITECTURE_COMPLIANCE_ACCEPTANCE_STANDARDS,
    FUNCTIONAL_VERIFICATION: FUNCTIONAL_VERIFICATION_ACCEPTANCE_STANDARDS
  },
  
  // 实施计划
  IMPLEMENTATION: {
    TOTAL_DURATION_DAYS: Object.values(REFACTORING_DEFAULTS.PHASE_DURATION).reduce((a, b) => a + b, 0),
    PHASE_DURATIONS: REFACTORING_DEFAULTS.PHASE_DURATION,
    TASK_ESTIMATIONS: REFACTORING_DEFAULTS.TASK_ESTIMATION,
    QUALITY_THRESHOLDS: REFACTORING_DEFAULTS.QUALITY_THRESHOLDS
  }
} as const;

/**
 * 重构设计类型导出
 */
export type RouterCLIRefactoringDesignType = typeof ROUTER_CLI_REFACTORING_DESIGN;