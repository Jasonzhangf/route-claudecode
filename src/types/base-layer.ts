/**
 * Base Layer Implementation with Dynamic Registration Support
 * Integrates with the dynamic registration framework
 */

import { LayerInterface, ProcessingContext, LayerCapabilities, DebugRecorder } from './interfaces.js';
import { 
  RegistrableModule, 
  ModuleCapabilities, 
  ModuleContext, 
  ModuleType,
  ModuleDependency
} from './registration.js';

export abstract class BaseLayer implements LayerInterface, RegistrableModule {
  public readonly name: string;
  public readonly version: string;
  public readonly dependencies: string[];
  protected debugRecorder?: DebugRecorder;
  protected moduleContext?: ModuleContext;
  protected initialized = false;

  constructor(
    name: string, 
    version: string = '1.0.0', 
    dependencies: string[] = [],
    protected moduleType: ModuleType = ModuleType.UTILITY
  ) {
    this.name = name;
    this.version = version;
    this.dependencies = dependencies;
    
    console.log(`🔧 ${name} layer created - dynamic registration enabled`);
  }

  abstract process(input: any, context: ProcessingContext): Promise<any>;

  // RegistrableModule implementation
  getCapabilities(): ModuleCapabilities {
    return {
      name: this.name,
      version: this.version,
      type: this.moduleType,
      supportedFormats: this.getSupportedFormats(),
      features: this.getFeatures(),
      dependencies: this.getModuleDependencies(),
      interfaces: this.getInterfaces()
    };
  }

  async initialize(context: ModuleContext): Promise<void> {
    if (this.initialized) {
      console.log(`🔧 ${this.name} already initialized`);
      return;
    }

    this.moduleContext = context;
    this.debugRecorder = context.debugRecorder;
    
    await this.onInitialize(context);
    this.initialized = true;
    
    console.log(`🔧 ${this.name} initialized successfully`);
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.onShutdown();
    this.initialized = false;
    this.moduleContext = undefined;
    this.debugRecorder = undefined;
    
    console.log(`🔧 ${this.name} shutdown completed`);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      return await this.performHealthCheck();
    } catch (error) {
      console.error(`🔧 ${this.name} health check failed:`, error);
      return false;
    }
  }

  // LayerInterface implementation
  getLayerCapabilities(): LayerCapabilities {
    const moduleCapabilities = this.getCapabilities();
    return {
      supportedFormats: moduleCapabilities.supportedFormats,
      features: moduleCapabilities.features,
      version: moduleCapabilities.version
    };
  }

  // Protected methods for subclasses to override
  protected getSupportedFormats(): string[] {
    return ['json', 'text'];
  }

  protected getFeatures(): string[] {
    return ['basic-processing', 'health-check', 'debug-recording'];
  }

  protected getModuleDependencies(): ModuleDependency[] {
    return this.dependencies.map(dep => ({
      name: dep,
      type: ModuleType.UTILITY,
      optional: false
    }));
  }

  protected getInterfaces(): string[] {
    return ['LayerInterface', 'RegistrableModule'];
  }

  protected async onInitialize(context: ModuleContext): Promise<void> {
    // Override in subclasses for custom initialization
  }

  protected async onShutdown(): Promise<void> {
    // Override in subclasses for custom shutdown
  }

  protected async performHealthCheck(): Promise<boolean> {
    // Override in subclasses for custom health checks
    return true;
  }

  protected async recordInput(data: any, context: ProcessingContext): Promise<void> {
    if (this.debugRecorder && context.debugEnabled) {
      this.debugRecorder.recordInput(this.name, data, {
        timestamp: new Date(),
        requestId: context.requestId,
        layerName: this.name,
        operation: 'process-input'
      });
    }
    console.log(`🔧 MOCKUP: ${this.name} input recorded - placeholder debug recording`);
  }

  protected async recordOutput(data: any, context: ProcessingContext): Promise<void> {
    if (this.debugRecorder && context.debugEnabled) {
      this.debugRecorder.recordOutput(this.name, data, {
        timestamp: new Date(),
        requestId: context.requestId,
        layerName: this.name,
        operation: 'process-output'
      });
    }
    console.log(`🔧 MOCKUP: ${this.name} output recorded - placeholder debug recording`);
  }

  setDebugRecorder(recorder: DebugRecorder): void {
    this.debugRecorder = recorder;
    console.log(`🔧 ${this.name} debug recorder set`);
  }

  protected isInitialized(): boolean {
    return this.initialized;
  }

  protected getModuleContext(): ModuleContext | undefined {
    return this.moduleContext;
  }
}

console.log('🔧 BaseLayer class loaded - dynamic registration support enabled');