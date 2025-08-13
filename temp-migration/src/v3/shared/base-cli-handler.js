#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Base CLI Handler
 * 
 * Provides consistent CLI interface patterns across all system components
 * with standardized command handling and help generation.
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import { createErrorHandler } from './error-handler.js';

export class BaseCLIHandler {
    constructor(componentName, version = '3.0.0') {
        this.componentName = componentName;
        this.version = version;
        this.errorHandler = createErrorHandler(`${componentName}-CLI`);
        this.commands = new Map();
        this.globalOptions = new Map();
        this.examples = [];
    }

    /**
     * Register a command with the CLI handler
     */
    registerCommand(name, handler, description, options = []) {
        this.commands.set(name, {
            name,
            handler,
            description,
            options,
            usage: this.generateUsage(name, options)
        });
        return this;
    }

    /**
     * Register a global option that applies to all commands
     */
    registerGlobalOption(name, description, required = false) {
        this.globalOptions.set(name, { name, description, required });
        return this;
    }

    /**
     * Add usage example
     */
    addExample(command, description) {
        this.examples.push({ command, description });
        return this;
    }

    /**
     * Parse command line arguments and execute appropriate handler
     */
    async runCLI(args = []) {
        try {
            if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
                return this.showHelp();
            }

            const commandName = args[0];
            const command = this.commands.get(commandName);

            if (!command) {
                this.errorHandler.handleValidationError(
                    'command',
                    commandName,
                    `Valid commands: ${Array.from(this.commands.keys()).join(', ')}`
                );
            }

            // Parse arguments for this command
            const parsedArgs = this.parseArguments(args.slice(1), command.options);
            
            // Validate required arguments
            this.validateRequiredArguments(parsedArgs, command.options);

            // Execute command handler
            const result = await command.handler(parsedArgs);
            
            return {
                command: commandName,
                status: 'success',
                result: result || {},
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`❌ CLI Error in ${this.componentName}:`, error.message);
            
            return {
                command: args[0] || 'unknown',
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Parse command line arguments into structured format
     */
    parseArguments(args, commandOptions) {
        const parsed = {
            positional: [],
            options: new Map(),
            flags: new Set()
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg.startsWith('--')) {
                const [key, value] = arg.substring(2).split('=');
                if (value !== undefined) {
                    parsed.options.set(key, value);
                } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    parsed.options.set(key, args[++i]);
                } else {
                    parsed.flags.add(key);
                }
            } else if (arg.startsWith('-')) {
                const flags = arg.substring(1);
                for (const flag of flags) {
                    parsed.flags.add(flag);
                }
            } else {
                parsed.positional.push(arg);
            }
        }

        return parsed;
    }

    /**
     * Validate that all required arguments are present
     */
    validateRequiredArguments(parsedArgs, commandOptions) {
        for (const option of commandOptions) {
            if (option.required) {
                const hasOption = parsedArgs.options.has(option.name) || 
                                parsedArgs.flags.has(option.name) ||
                                (option.positional && parsedArgs.positional.length > option.position);

                if (!hasOption) {
                    this.errorHandler.handleValidationError(
                        'required-argument',
                        option.name,
                        `${option.name} is required. ${option.description}`
                    );
                }
            }
        }
    }

    /**
     * Generate usage string for a command
     */
    generateUsage(commandName, options) {
        const optionStrings = options.map(opt => {
            const prefix = opt.required ? '' : '[';
            const suffix = opt.required ? '' : ']';
            
            if (opt.positional) {
                return `${prefix}<${opt.name}>${suffix}`;
            } else if (opt.flag) {
                return `${prefix}--${opt.name}${suffix}`;
            } else {
                return `${prefix}--${opt.name}=<value>${suffix}`;
            }
        });

        return `${commandName} ${optionStrings.join(' ')}`;
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log(`
🛠️ Claude Code Router v${this.version} - ${this.componentName}

Usage: ${this.componentName.toLowerCase()}.js <command> [options]

Commands:`);

        // Sort commands alphabetically
        const sortedCommands = Array.from(this.commands.values()).sort((a, b) => a.name.localeCompare(b.name));
        
        for (const command of sortedCommands) {
            console.log(`  ${command.usage.padEnd(30)} ${command.description}`);
            
            if (command.options.length > 0) {
                for (const option of command.options) {
                    const optionDesc = `    ${option.required ? '(required)' : '(optional)'} ${option.description}`;
                    console.log(optionDesc);
                }
                console.log('');
            }
        }

        if (this.globalOptions.size > 0) {
            console.log(`\nGlobal Options:`);
            for (const [name, option] of this.globalOptions) {
                console.log(`  --${name.padEnd(20)} ${option.description}`);
            }
        }

        if (this.examples.length > 0) {
            console.log(`\nExamples:`);
            for (const example of this.examples) {
                console.log(`  ${example.command}`);
                console.log(`    ${example.description}`);
                console.log('');
            }
        }

        console.log(`\nHelp:`);
        console.log(`  ${this.componentName.toLowerCase()}.js help`);
        console.log(`  ${this.componentName.toLowerCase()}.js --help`);
        console.log('');

        return { command: 'help', status: 'success' };
    }

    /**
     * Get CLI statistics
     */
    getStats() {
        return {
            componentName: this.componentName,
            version: this.version,
            commandCount: this.commands.size,
            globalOptionsCount: this.globalOptions.size,
            examplesCount: this.examples.length,
            errorStats: this.errorHandler.getErrorStats()
        };
    }
}

export default BaseCLIHandler;