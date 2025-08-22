/**
 * CLI命令解析器
 *
 * 负责解析命令行参数并转换为标准化的命令对象
 *
 * @author Jason Zhang
 */
import { CLIHandler, ParsedCommand } from '../interfaces';
import { ICommandExecutor } from '../interfaces/core/cli-abstraction';
/**
 * CLI命令解析器实现
 */
export declare class CommandParser implements CLIHandler {
    private commands;
    private commandExecutor?;
    constructor(commandExecutor?: ICommandExecutor);
    /**
     * 解析命令行参数
     */
    parseArguments(args: string[]): ParsedCommand;
    /**
     * 执行命令
     */
    executeCommand(command: ParsedCommand): Promise<void>;
    /**
     * 显示帮助信息
     */
    showHelp(command?: string): void;
    /**
     * 显示版本信息
     */
    showVersion(): void;
    /**
     * 初始化命令定义
     */
    private initializeCommands;
    /**
     * 解析选项和参数
     */
    private parseOptions;
    /**
     * 解析选项值
     */
    private parseOptionValue;
    /**
     * 转换为驼峰命名
     */
    private camelCase;
    /**
     * 显示通用帮助信息
     */
    private showGeneralHelp;
    /**
     * 显示具体命令帮助
     */
    private showCommandHelp;
    /**
     * 执行配置命令
     */
    private executeConfigCommand;
    /**
     * 执行认证命令
     */
    private executeAuthCommand;
}
//# sourceMappingURL=command-parser.d.ts.map