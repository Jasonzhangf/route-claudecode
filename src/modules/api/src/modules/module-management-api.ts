/**
 * Module Management API
 */

// 存储所有模块实例
const moduleInstances = new Map<string, any>();

export enum ModuleType {
  VALIDATOR = 'validator',
  TRANSFORMER = 'transformer', 
  PROTOCOL = 'protocol',
  SERVER_COMPATIBILITY = 'server-compatibility',
  SERVER = 'server',
  ROUTER = 'router',
  PIPELINE = 'pipeline',
  CLIENT = 'client',
  CONFIG = 'config',
  DEBUG = 'debug'
}

export interface CreateModuleRequest {
  type: ModuleType;
  moduleType: string;
  config?: any;
}

export interface CreateModuleResponse {
  id: string;
  type: ModuleType;
  moduleType: string;
  status: 'created';
}

export interface StartModuleRequest {
  id: string;
}

export interface StartModuleResponse {
  id: string;
  status: 'started' | 'error';
}

export interface StopModuleRequest {
  id: string;
}

export interface StopModuleResponse {
  id: string;
  status: 'stopped' | 'error';
}

export interface ProcessModuleRequest {
  id: string;
  input: any;
}

export interface ProcessModuleResponse {
  output: any;
}

export interface GetModuleStatusResponse {
  id: string;
  type: ModuleType;
  moduleType: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'idle' | 'busy';
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export async function createModule(request: CreateModuleRequest): Promise<CreateModuleResponse> {
  const id = `module_${Date.now()}`;
  
  const module = {
    id,
    type: request.type,
    moduleType: request.moduleType,
    status: 'created',
    health: 'healthy',
    
    start: async function() {
      this.status = 'running';
    },
    
    stop: async function() {
      this.status = 'stopped';
    },
    
    process: async function(input: any) {
      return input;
    },
    
    getStatus: function() {
      return {
        id: this.id,
        type: this.type,
        moduleType: this.moduleType,
        status: this.status,
        health: this.health
      };
    }
  };
  
  moduleInstances.set(id, module);
  
  return {
    id,
    type: request.type,
    moduleType: request.moduleType,
    status: 'created'
  };
}

export async function startModule(request: StartModuleRequest): Promise<StartModuleResponse> {
  const module = moduleInstances.get(request.id);
  if (!module) {
    return { id: request.id, status: 'error' };
  }
  
  await module.start();
  
  return {
    id: request.id,
    status: 'started'
  };
}

export async function stopModule(request: StopModuleRequest): Promise<StopModuleResponse> {
  const module = moduleInstances.get(request.id);
  if (!module) {
    return { id: request.id, status: 'error' };
  }
  
  await module.stop();
  
  return {
    id: request.id,
    status: 'stopped'
  };
}

export async function processWithModule(request: ProcessModuleRequest): Promise<ProcessModuleResponse> {
  const module = moduleInstances.get(request.id);
  if (!module) {
    return { output: null };
  }
  
  const output = await module.process(request.input);
  
  return {
    output
  };
}

export async function getModuleStatus(id: string): Promise<GetModuleStatusResponse> {
  const module = moduleInstances.get(id);
  if (!module) {
    return {
      id,
      type: ModuleType.TRANSFORMER,
      moduleType: 'not-found',
      status: 'error',
      health: 'unhealthy'
    };
  }
  
  return module.getStatus();
}

export async function destroyModule(id: string): Promise<void> {
  const module = moduleInstances.get(id);
  if (module) {
    await module.stop();
    moduleInstances.delete(id);
  }
}