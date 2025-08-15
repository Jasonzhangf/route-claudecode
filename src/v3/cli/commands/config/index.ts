/**
 * Config命令组 - 配置文件管理
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

import { Command } from 'commander';
import { createGenerateStandardCommand, createValidateStandardCommand } from './generate-standard.js';
// import { createDynamicConfigCommand } from './dynamic-config-generator.js';

export function createConfigCommand(): Command {
  const configCommand = new Command('config');
  
  configCommand
    .description('Configuration file management for v3.1.0 standard format')
    .addCommand(createGenerateStandardCommand())
    .addCommand(createValidateStandardCommand());
    // .addCommand(createDynamicConfigCommand());
  
  return configCommand;
}