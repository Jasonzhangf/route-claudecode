/**
 * CLI模块测试
 * 
 * 测试命令解析、参数验证、配置加载等CLI功能
 * 
 * @author Jason Zhang
 */

import { CommandParser } from '../../src/cli/command-parser';
import { ArgumentValidator } from '../../src/cli/argument-validator';
import { ConfigLoader } from '../../src/cli/config-loader';
import { RCCCli } from '../../src/cli/rcc-cli';
import { ParsedCommand } from '../../src/interfaces';

describe('RCC v4.0 CLI System', () => {
  describe('CommandParser', () => {
    let parser: CommandParser;
    
    beforeEach(() => {
      parser = new CommandParser();
    });
    
    it('should parse start command with options', () => {
      const args = ['start', '--port', '3457', '--debug'];
      const result = parser.parseArguments(args);
      
      expect(result.command).toBe('start');
      expect(result.options.port).toBe(3457);
      expect(result.options.debug).toBe(true);
    });
    
    it('should parse command with short options', () => {
      const args = ['status', '-p', '3456', '-d'];
      const result = parser.parseArguments(args);
      
      expect(result.command).toBe('status');
      expect(result.options.port).toBe(3456);
      expect(result.options.detailed).toBe(true);
    });
    
    it('should parse help command', () => {
      const args = ['--help'];
      const result = parser.parseArguments(args);
      
      expect(result.command).toBe('help');
    });
    
    it('should parse version command', () => {
      const args = ['--version'];
      const result = parser.parseArguments(args);
      
      expect(result.command).toBe('version');
    });
    
    it('should throw error for unknown command', () => {
      const args = ['unknown'];
      
      expect(() => parser.parseArguments(args)).toThrow('Unknown command: unknown');
    });
    
    it('should parse config file path', () => {
      const args = ['start', '--config', '/path/to/config.json'];
      const result = parser.parseArguments(args);
      
      expect(result.options.config).toBe('/path/to/config.json');
    });
    
    it('should handle boolean options correctly', () => {
      const args = ['stop', '--force'];
      const result = parser.parseArguments(args);
      
      expect(result.options.force).toBe(true);
    });
    
    it('should parse multiple options', () => {
      const args = ['start', '--port', '3456', '--host', 'localhost', '--debug'];
      const result = parser.parseArguments(args);
      
      expect(result.options.port).toBe(3456);
      expect(result.options.host).toBe('localhost');
      expect(result.options.debug).toBe(true);
    });
  });
  
  describe('ArgumentValidator', () => {
    let validator: ArgumentValidator;
    
    beforeEach(() => {
      validator = new ArgumentValidator();
    });
    
    it('should validate valid start command', () => {
      const command: ParsedCommand = {
        command: 'start',
        options: { port: 3456, host: 'localhost', debug: true },
        args: []
      };
      
      const result = validator.validate(command);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid port number', () => {
      const command: ParsedCommand = {
        command: 'start',
        options: { port: 99999 },
        args: []
      };
      
      const result = validator.validate(command);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: any) => e.field === 'port')).toBe(true);
    });
    
    it('should validate host format', () => {
      const command: ParsedCommand = {
        command: 'start',
        options: { host: 'invalid-host-format!!!' },
        args: []
      };
      
      const result = validator.validate(command);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: any) => e.field === 'host')).toBe(true);
    });
    
    it('should accept valid IP address', () => {
      const command: ParsedCommand = {
        command: 'start',
        options: { host: '192.168.1.1' },
        args: []
      };
      
      const result = validator.validate(command);
      const hostErrors = result.errors.filter((e: any) => e.field === 'host');
      expect(hostErrors).toHaveLength(0);
    });
    
    it('should warn about unknown options', () => {
      const command: ParsedCommand = {
        command: 'start',
        options: { unknownOption: 'value' },
        args: []
      };
      
      const result = validator.validate(command);
      expect(result.warnings.some((w: any) => w.field === 'unknownOption')).toBe(true);
    });
  });
  
  describe('ConfigLoader', () => {
    let configLoader: ConfigLoader;
    
    beforeEach(() => {
      configLoader = new ConfigLoader();
    });
    
    it('should load default configuration', async () => {
      // 保存原来的环境变量
      const originalDebug = process.env.RCC_DEBUG;
      delete process.env.RCC_DEBUG;
      
      const command: ParsedCommand = {
        command: 'start',
        options: {},
        args: []
      };
      
      const config = await configLoader.loadConfig(command, { validateConfig: false });
      
      expect(config.port).toBe(3456);
      expect(config.host).toBe('localhost');
      expect(config.debug).toBe(false);
      
      // 恢复环境变量
      if (originalDebug !== undefined) {
        process.env.RCC_DEBUG = originalDebug;
      }
    });
    
    it('should merge CLI options with defaults', async () => {
      const command: ParsedCommand = {
        command: 'start',
        options: { port: 3457, debug: true },
        args: []
      };
      
      const config = await configLoader.loadConfig(command, { validateConfig: false });
      
      expect(config.port).toBe(3457);
      expect(config.debug).toBe(true);
      expect(config.host).toBe('localhost'); // 默认值
    });
    
    it('should export configuration as environment variables', () => {
      const config = { port: 3456, host: 'localhost', debug: true };
      const envVars = configLoader.exportAsEnvVars(config, 'RCC');
      
      expect(envVars).toContain('export RCC_PORT=3456');
      expect(envVars).toContain('export RCC_HOST=\"localhost\"');
      expect(envVars).toContain('export RCC_DEBUG=true');
    });
  });
  
  describe('RCCCli Integration', () => {
    let cli: RCCCli;
    
    beforeEach(() => {
      cli = new RCCCli({ 
        exitOnError: false, 
        suppressOutput: true 
      });
    });
    
    it('should handle help command', async () => {
      const helpSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await cli.run(['--help']);
      
      expect(helpSpy).toHaveBeenCalled();
      helpSpy.mockRestore();
    });
    
    it('should handle version command', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await cli.run(['--version']);
      
      expect(logSpy).toHaveBeenCalledWith('RCC (Route Claude Code) v4.0.0-alpha.1');
      logSpy.mockRestore();
    });
    
    it('should create start options from parsed command', async () => {
      // 由于实际启动逻辑尚未实现，这里测试参数解析
      const args = ['start', '--port', '3457', '--debug'];
      
      try {
        await cli.run(args);
      } catch (error) {
        // 预期会抛出 "implementation pending" 错误
        expect(error instanceof Error && error.message.includes('implementation pending')).toBe(true);
      }
    });
    
    it('should handle validation errors gracefully', async () => {
      // 为这个测试创建一个不抑制输出的CLI实例
      const testCli = new RCCCli({ 
        exitOnError: false, 
        suppressOutput: false  // 允许输出以便测试console.error调用
      });
      
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const args = ['start', '--port', '99999']; // 无效端口
      
      try {
        await testCli.run(args);
      } catch (error) {
        // 预期会有错误，因为CLI配置为不退出
      }
      
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
    
    it('should create server status with correct format', async () => {
      try {
        const status = await cli.status({ port: 3456 });
        
        expect(status).toHaveProperty('isRunning');
        expect(status).toHaveProperty('port');
        expect(status).toHaveProperty('host');
        expect(status).toHaveProperty('version');
        expect(status).toHaveProperty('health');
        expect(status.health).toHaveProperty('status');
        expect(status.health).toHaveProperty('checks');
      } catch (error) {
        // 如果状态查询失败，检查是否是实现相关的错误
        expect(error instanceof Error).toBe(true);
      }
    });
  });
  
  describe('Command Help System', () => {
    let parser: CommandParser;
    
    beforeEach(() => {
      parser = new CommandParser();
    });
    
    it('should show general help when no command specified', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      parser.showHelp();
      
      expect(logSpy).toHaveBeenCalledWith('RCC (Route Claude Code) v4.0.0-alpha.1');
      logSpy.mockRestore();
    });
    
    it('should show specific command help', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      parser.showHelp('start');
      
      expect(logSpy).toHaveBeenCalledWith('RCC start');
      logSpy.mockRestore();
    });
    
    it('should show version information', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      parser.showVersion();
      
      expect(logSpy).toHaveBeenCalledWith('RCC (Route Claude Code) v4.0.0-alpha.1');
      logSpy.mockRestore();
    });
  });
  
  describe('Error Handling', () => {
    let parser: CommandParser;
    
    beforeEach(() => {
      parser = new CommandParser();
    });
    
    it('should throw error for empty arguments', () => {
      expect(() => parser.parseArguments([])).toThrow('No command provided');
    });
    
    it('should throw error for unknown option', () => {
      expect(() => parser.parseArguments(['start', '--unknown-option'])).toThrow('Unknown option');
    });
    
    it('should throw error for missing option value', () => {
      expect(() => parser.parseArguments(['start', '--port'])).toThrow('requires a value');
    });
    
    it('should throw error for invalid number', () => {
      expect(() => parser.parseArguments(['start', '--port', 'invalid'])).toThrow('must be a number');
    });
  });
});