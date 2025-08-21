/**
 * 重构相关常量定义
 * 
 * 包含所有重构设计相关的常量，遵循零硬编码原则
 * 
 * @module RefactoringConstants
 * @version 1.0.0
 * @lastUpdated 2025-08-21
 */

// =============================================================================
// 重构目标和原则常量
// =============================================================================

/**
 * 重构目标类型常量
 */
export const REFACTORING_GOALS = {
  MODULE_RESPONSIBILITY_CLARITY: 'MODULE_RESPONSIBILITY_CLARITY',
  REDUNDANT_CODE_CLEANUP: 'REDUNDANT_CODE_CLEANUP',
  INTERFACE_STANDARDIZATION: 'INTERFACE_STANDARDIZATION', 
  HARDCODE_ELIMINATION: 'HARDCODE_ELIMINATION',
  ARCHITECTURE_COMPLIANCE: 'ARCHITECTURE_COMPLIANCE'
} as const;

/**
 * 重构原则常量
 */
export const REFACTORING_PRINCIPLES = {
  CLEANUP_FIRST_THEN_REFACTOR: 'CLEANUP_FIRST_THEN_REFACTOR',
  BACKWARD_COMPATIBILITY: 'BACKWARD_COMPATIBILITY',
  PROGRESSIVE_IMPLEMENTATION: 'PROGRESSIVE_IMPLEMENTATION',
  ZERO_FALLBACK: 'ZERO_FALLBACK',
  TYPESCRIPT_ONLY: 'TYPESCRIPT_ONLY'
} as const;

/**
 * 重构阶段常量
 */
export const REFACTORING_PHASES = {
  REDUNDANT_FILE_DELETION: 'REDUNDANT_FILE_DELETION',
  HARDCODE_CLEANUP: 'HARDCODE_CLEANUP',
  ROUTER_MODULE_REFACTORING: 'ROUTER_MODULE_REFACTORING',
  CLI_MODULE_REFACTORING: 'CLI_MODULE_REFACTORING',
  INTEGRATION_TESTING: 'INTEGRATION_TESTING'
} as const;

// =============================================================================
// 文件状态和操作常量
// =============================================================================

/**
 * 文件状态常量
 */
export const FILE_STATUS = {
  KEEP: 'KEEP',
  REFACTOR: 'REFACTOR',
  DELETE: 'DELETE', 
  DEPRECATED: 'DEPRECATED'
} as const;

/**
 * 清理操作类型常量
 */
export const CLEANUP_OPERATIONS = {
  DELETE_FILE: 'DELETE_FILE',
  MERGE_FILES: 'MERGE_FILES',
  MIGRATE_CONSTANTS: 'MIGRATE_CONSTANTS',
  UPDATE_REFERENCES: 'UPDATE_REFERENCES'
} as const;

/**
 * 重构操作常量
 */
export const REFACTORING_OPERATIONS = {
  EXTRACT_INTERFACE: 'EXTRACT_INTERFACE',
  IMPLEMENT_ERROR_BOUNDARY: 'IMPLEMENT_ERROR_BOUNDARY',
  MIGRATE_HARDCODED_VALUES: 'MIGRATE_HARDCODED_VALUES',
  ADD_DEPENDENCY_INJECTION: 'ADD_DEPENDENCY_INJECTION',
  STANDARDIZE_ERROR_HANDLING: 'STANDARDIZE_ERROR_HANDLING'
} as const;

// =============================================================================
// 架构违规类型常量
// =============================================================================

/**
 * 架构违规类型常量
 */
export const ARCHITECTURE_VIOLATION_TYPES = {
  RESPONSIBILITY_BOUNDARY_BLUR: 'RESPONSIBILITY_BOUNDARY_BLUR',
  SEVERE_HARDCODING: 'SEVERE_HARDCODING',
  NON_UNIFORM_ERROR_HANDLING: 'NON_UNIFORM_ERROR_HANDLING',
  NON_STANDARD_INTERFACE: 'NON_STANDARD_INTERFACE',
  CROSS_MODULE_CONFIG_ACCESS: 'CROSS_MODULE_CONFIG_ACCESS'
} as const;

/**
 * 硬编码违规类型常量
 */
export const HARDCODING_VIOLATION_TYPES = {
  URL_HARDCODING: 'URL_HARDCODING',
  PORT_HARDCODING: 'PORT_HARDCODING',
  ERROR_MESSAGE_HARDCODING: 'ERROR_MESSAGE_HARDCODING',
  TIMEOUT_HARDCODING: 'TIMEOUT_HARDCODING',
  COMMAND_STRING_HARDCODING: 'COMMAND_STRING_HARDCODING',
  FILE_PATH_HARDCODING: 'FILE_PATH_HARDCODING'
} as const;

// =============================================================================
// 组件和接口层次常量
// =============================================================================

/**
 * 路由器核心组件常量
 */
export const ROUTER_CORE_COMPONENTS = {
  PIPELINE_ROUTER: 'PIPELINE_ROUTER',
  SIMPLE_ROUTER: 'SIMPLE_ROUTER',
  LOAD_BALANCER: 'LOAD_BALANCER',
  VIRTUAL_MODEL_MAPPING: 'VIRTUAL_MODEL_MAPPING',
  SESSION_CONTROL: 'SESSION_CONTROL'
} as const;

/**
 * CLI核心组件常量
 */
export const CLI_CORE_COMPONENTS = {
  RCC_CLI: 'RCC_CLI',
  COMMAND_PARSER: 'COMMAND_PARSER',
  COMMAND_EXECUTOR: 'COMMAND_EXECUTOR',
  ARGUMENT_VALIDATOR: 'ARGUMENT_VALIDATOR',
  CLI_UTILS: 'CLI_UTILS'
} as const;

/**
 * 接口层次常量
 */
export const INTERFACE_LEVELS = {
  MODULE_INTERFACE: 'MODULE_INTERFACE',
  ERROR_BOUNDARY: 'ERROR_BOUNDARY',
  COMMAND_PARSER: 'COMMAND_PARSER',
  COMMAND_EXECUTOR: 'COMMAND_EXECUTOR',
  ARGUMENT_VALIDATOR: 'ARGUMENT_VALIDATOR',
  PIPELINE_MANAGER: 'PIPELINE_MANAGER',
  LOAD_BALANCER: 'LOAD_BALANCER'
} as const;

// =============================================================================
// 错误处理和依赖注入常量
// =============================================================================

/**
 * 错误处理策略常量
 */
export const ERROR_HANDLING_STRATEGIES = {
  IMMEDIATE_PROPAGATION: 'IMMEDIATE_PROPAGATION',
  LOGGED_PROPAGATION: 'LOGGED_PROPAGATION',
  WRAPPED_PROPAGATION: 'WRAPPED_PROPAGATION'
} as const;

/**
 * 服务生命周期常量
 */
export const SERVICE_LIFECYCLES = {
  SINGLETON: 'SINGLETON',
  TRANSIENT: 'TRANSIENT',
  SCOPED: 'SCOPED'
} as const;

/**
 * 注入方法常量
 */
export const INJECTION_METHODS = {
  CONSTRUCTOR_INJECTION: 'CONSTRUCTOR_INJECTION',
  PROPERTY_INJECTION: 'PROPERTY_INJECTION',
  METHOD_INJECTION: 'METHOD_INJECTION'
} as const;

// =============================================================================
// 风险评估常量
// =============================================================================

/**
 * 风险级别常量
 */
export const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const;

// =============================================================================
// 重构任务类型常量
// =============================================================================

/**
 * 重构任务类型常量
 */
export const REFACTORING_TASK_TYPES = {
  INTERFACE_DESIGN: 'INTERFACE_DESIGN',
  CORE_LOGIC_REFACTOR: 'CORE_LOGIC_REFACTOR',
  ERROR_BOUNDARY_IMPLEMENTATION: 'ERROR_BOUNDARY_IMPLEMENTATION',
  DEPENDENCY_INJECTION_SETUP: 'DEPENDENCY_INJECTION_SETUP'
} as const;

// =============================================================================
// 重构配置默认值
// =============================================================================

/**
 * 重构默认配置
 */
export const REFACTORING_DEFAULTS = {
  VERSION: '4.0.0-beta.1',
  LAST_UPDATED: '2025-08-21',
  AUTHOR: 'RCC v4.0 Team',
  PHASE_DURATION: {
    CLEANUP_DAYS: 2,
    ROUTER_REFACTOR_DAYS: 3,
    CLI_REFACTOR_DAYS: 3,
    INTEGRATION_DAYS: 2
  },
  TASK_ESTIMATION: {
    DELETE_FILE_HOURS: 0.5,
    UPDATE_REFERENCES_HOURS: 0.5,
    MIGRATE_CONSTANTS_HOURS: 2,
    INTERFACE_DESIGN_HOURS: 4,
    CORE_LOGIC_REFACTOR_HOURS: 8,
    ERROR_BOUNDARY_HOURS: 3,
    DEPENDENCY_INJECTION_HOURS: 6
  },
  QUALITY_THRESHOLDS: {
    CODE_COVERAGE_PERCENT: 80,
    TYPE_COVERAGE_PERCENT: 95,
    RESPONSE_TIME_MS: 100,
    MEMORY_USAGE_MB: 200
  }
} as const;

// =============================================================================
// 文件路径常量
// =============================================================================

/**
 * 重构相关文件路径常量
 */
export const REFACTORING_FILE_PATHS = {
  ROUTER_MODULE: {
    INDEX: 'src/router/index.ts',
    PIPELINE_ROUTER: 'src/router/pipeline-router.ts',
    SIMPLE_ROUTER: 'src/router/simple-router.ts',
    LOAD_BALANCER: 'src/router/load-balancer.ts',
    PIPELINE_TABLE_LOADER: 'src/router/pipeline-table-loader.ts',
    VIRTUAL_MODEL_MAPPING: 'src/router/virtual-model-mapping.ts',
    SESSION_CONTROL_DIR: 'src/router/session-control'
  },
  CLI_MODULE: {
    INDEX: 'src/cli/index.ts',
    RCC_CLI: 'src/cli/rcc-cli.ts',
    UNIFIED_CLI: 'src/cli/unified-cli.ts',
    COMMAND_PARSER: 'src/cli/command-parser.ts',
    COMMAND_EXECUTOR: 'src/cli/command-executor.ts',
    ARGUMENT_VALIDATOR: 'src/cli/argument-validator.ts',
    CLI_UTILS: 'src/cli/cli-utils.ts'
  },
  CONSTANTS: {
    ROUTER_DEFAULTS: 'src/constants/router-defaults.ts',
    CLI_DEFAULTS: 'src/constants/cli-defaults.ts',
    ERROR_MESSAGES: 'src/constants/error-messages.ts',
    REFACTORING_CONSTANTS: 'src/constants/refactoring-constants.ts'
  },
  INTERFACES: {
    ROUTER_INTERFACE: 'src/interfaces/core/router-interface.ts',
    CLIENT_INTERFACE: 'src/interfaces/core/client-interface.ts',
    MODULE_INTERFACE: 'src/interfaces/core/module-interface.ts'
  }
} as const;

// =============================================================================
// 验收标准常量
// =============================================================================

/**
 * 验收标准类别常量
 */
export const ACCEPTANCE_CRITERIA_CATEGORIES = {
  CODE_QUALITY: 'CODE_QUALITY',
  ARCHITECTURE_COMPLIANCE: 'ARCHITECTURE_COMPLIANCE', 
  FUNCTIONAL_VERIFICATION: 'FUNCTIONAL_VERIFICATION',
  DOCUMENTATION: 'DOCUMENTATION'
} as const;

/**
 * 代码质量标准常量
 */
export const CODE_QUALITY_STANDARDS = {
  ZERO_HARDCODING: 'ZERO_HARDCODING',
  TYPESCRIPT_COVERAGE: 'TYPESCRIPT_COVERAGE',
  STANDARD_INTERFACES: 'STANDARD_INTERFACES',
  ERROR_BOUNDARIES: 'ERROR_BOUNDARIES',
  UNIT_TEST_COVERAGE: 'UNIT_TEST_COVERAGE'
} as const;

/**
 * 架构合规标准常量
 */
export const ARCHITECTURE_COMPLIANCE_STANDARDS = {
  SIX_LAYER_ARCHITECTURE: 'SIX_LAYER_ARCHITECTURE',
  MODULE_RESPONSIBILITIES: 'MODULE_RESPONSIBILITIES',
  DEPENDENCY_CONSTRAINTS: 'DEPENDENCY_CONSTRAINTS',
  CONFIG_ACCESS_PERMISSIONS: 'CONFIG_ACCESS_PERMISSIONS',
  INTERFACE_VERSION_CONTROL: 'INTERFACE_VERSION_CONTROL'
} as const;

/**
 * 功能验证标准常量
 */
export const FUNCTIONAL_VERIFICATION_STANDARDS = {
  CLI_COMMANDS_WORKING: 'CLI_COMMANDS_WORKING',
  ROUTING_FUNCTIONALITY: 'ROUTING_FUNCTIONALITY',
  LOAD_BALANCING: 'LOAD_BALANCING',
  ERROR_HANDLING: 'ERROR_HANDLING',
  PERFORMANCE_METRICS: 'PERFORMANCE_METRICS'
} as const;

// =============================================================================
// 硬编码违规示例常量 (用于文档和设计)
// =============================================================================

/**
 * 硬编码违规示例常量
 * 用于重构设计文档中的示例展示
 */
export const HARDCODING_VIOLATION_EXAMPLES = {
  TIMEOUT_EXAMPLE: 'timeout: 30000',
  PORT_EXAMPLE: 'defaultPort: 5506', 
  ERROR_EXAMPLE: 'throw new Error("Invalid command")',
  LINE_NUMBERS: {
    PIPELINE_TABLE_LOADER: 45,
    CLI_UTILS: 23,
    COMMAND_EXECUTOR: 67
  }
} as const;

// =============================================================================
// 导出类型定义
// =============================================================================

export type RefactoringGoal = typeof REFACTORING_GOALS[keyof typeof REFACTORING_GOALS];
export type RefactoringPrinciple = typeof REFACTORING_PRINCIPLES[keyof typeof REFACTORING_PRINCIPLES];
export type RefactoringPhase = typeof REFACTORING_PHASES[keyof typeof REFACTORING_PHASES];
export type FileStatus = typeof FILE_STATUS[keyof typeof FILE_STATUS];
export type CleanupOperation = typeof CLEANUP_OPERATIONS[keyof typeof CLEANUP_OPERATIONS];
export type RefactoringOperation = typeof REFACTORING_OPERATIONS[keyof typeof REFACTORING_OPERATIONS];
export type ArchitectureViolationType = typeof ARCHITECTURE_VIOLATION_TYPES[keyof typeof ARCHITECTURE_VIOLATION_TYPES];
export type HardcodingViolationType = typeof HARDCODING_VIOLATION_TYPES[keyof typeof HARDCODING_VIOLATION_TYPES];
export type RouterCoreComponent = typeof ROUTER_CORE_COMPONENTS[keyof typeof ROUTER_CORE_COMPONENTS];
export type CLICoreComponent = typeof CLI_CORE_COMPONENTS[keyof typeof CLI_CORE_COMPONENTS];
export type InterfaceLevel = typeof INTERFACE_LEVELS[keyof typeof INTERFACE_LEVELS];
export type ErrorHandlingStrategy = typeof ERROR_HANDLING_STRATEGIES[keyof typeof ERROR_HANDLING_STRATEGIES];
export type ServiceLifecycle = typeof SERVICE_LIFECYCLES[keyof typeof SERVICE_LIFECYCLES];
export type InjectionMethod = typeof INJECTION_METHODS[keyof typeof INJECTION_METHODS];
export type RiskLevel = typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
export type RefactoringTaskType = typeof REFACTORING_TASK_TYPES[keyof typeof REFACTORING_TASK_TYPES];