import { CLIModeInterface, ModeOptions, ModeStatus } from './mode-interface';
import { ServerMode } from './cli-server';
import { ClientMode } from './cli-client';

export class CLIManager {
  private modes: Map<string, CLIModeInterface>;
  private currentMode?: CLIModeInterface;

  constructor() {
    this.modes = new Map();
    this.modes.set('start', new ServerMode());
    this.modes.set('server', new ServerMode());
    this.modes.set('code', new ClientMode());
    this.modes.set('client', new ClientMode());

    // 注册进程退出处理
    this.registerExitHandlers();
  }

  async executeCommand(command: string, options: ModeOptions): Promise<void> {
    const mode = this.modes.get(command);
    if (!mode) {
      throw new Error(`Unknown command: ${command}. Available commands: ${Array.from(this.modes.keys()).join(', ')}`);
    }

    try {
      console.log(`Starting ${mode.name} mode...`);
      this.currentMode = mode;
      await mode.start(options);
    } catch (error) {
      console.error(`Failed to start ${mode.name} mode:`, error);
      throw error;
    }
  }

  async stopCurrentMode(): Promise<void> {
    if (this.currentMode) {
      console.log(`Stopping ${this.currentMode.name} mode...`);
      await this.currentMode.stop();
      this.currentMode = undefined;
    }
  }

  getStatus(): ModeStatus | null {
    if (!this.currentMode) {
      return null;
    }

    return this.currentMode.getStatus();
  }

  async healthCheck(): Promise<any> {
    if (!this.currentMode) {
      return { healthy: false, reason: 'No active mode' };
    }

    return await this.currentMode.healthCheck();
  }

  listAvailableModes(): string[] {
    return Array.from(this.modes.keys());
  }

  getModeDescription(command: string): string | null {
    const mode = this.modes.get(command);
    return mode ? mode.description : null;
  }

  private registerExitHandlers(): void {
    // 优雅退出处理
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      try {
        await this.stopCurrentMode();
        console.log('Shutdown completed successfully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // 处理未捕获的异常
    process.on('uncaughtException', async error => {
      console.error('Uncaught Exception:', error);
      try {
        await this.stopCurrentMode();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      try {
        await this.stopCurrentMode();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
      process.exit(1);
    });
  }
}
