#!/usr/bin/env node
/**
 * RCC v4.0 CLI入口 - 统一CLI系统
 *
 * 遵循.claude/rules/unified-cli-config-template.md永久模板规则
 * 使用UnifiedCLI和ConfigReader实现配置统一化
 *
 * @author Jason Zhang
 */
import { ParsedCommand, CLIHandler } from './interfaces/client/cli-interface';
/**
 * CLI处理器实现
 */
declare class RCCv4CLIHandler implements CLIHandler {
    private rccCLI;
    private argumentParser;
    constructor();
    /**
     * 解析命令行参数
     */
    parseArguments(args: string[]): ParsedCommand;
    /**
     * 执行命令
     */
    executeCommand(parsedCommand: ParsedCommand): Promise<void>;
    /**
     * 处理start命令
     */
    private handleStart;
    /**
     * 处理stop命令
     */
    private handleStop;
    /**
     * 处理status命令
     */
    private handleStatus;
    /**
     * 处理code命令
     */
    private handleCode;
    /**
     * 处理config命令
     */
    private handleConfig;
    /**
     * 处理auth命令
     */
    private handleAuth;
    /**
     * 处理provider命令
     */
    private handleProvider;
    /**
     * 处理provider update命令
     */
    private handleProviderUpdate;
    /**
     * 显示帮助信息
     */
    showHelp(command?: string): void;
    /**
     * 显示特定命令的帮助
     */
    private showCommandHelp;
    /**
     * 显示版本信息
     */
    showVersion(): void;
}
export { RCCv4CLIHandler };
//# sourceMappingURL=cli.d.ts.map