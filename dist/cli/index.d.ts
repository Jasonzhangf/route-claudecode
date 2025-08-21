/**
 * RCC v4.0 CLI模块导出
 *
 * 基于新的标准化接口架构:
 * - CLIModuleInterface: 标准CLI接口
 * - CommandParser: 命令解析器
 * - ArgumentValidator: 参数验证器
 * - CommandExecutor: 命令执行器
 * - 统一的配置和错误处理
 *
 * @version 4.0.0-beta.1
 * @author RCC v4.0 Team
 */
export type { CLIModuleInterface, CLIModuleConfig, CLIModuleMetrics, ParsedCommand, ExecutionResult, CommandDefinition, OptionDefinition, ValidationResult, ValidationError, ValidationRule, ValidationWarning, CommandParser, ArgumentValidator, CommandExecutor, CLIHandler, CLICommands, StartOptions, StopOptions, CodeOptions, StatusOptions, ConfigOptions, ServerStatus, HealthCheck, BaseCLIModule } from '../interfaces/core/cli-interface';
export { RCCCli } from './rcc-cli';
export declare const CLI_MODULE_VERSION = "4.0.0-beta.1";
export interface CLModuleInterface {
    version: string;
    run(args?: string[]): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map