/**
 * Dependency Resolution System
 * Resolves module dependencies and determines load order
 */

import {
  DependencyResolver,
  ModuleCapabilities,
  ModuleMetadata,
  ResolutionResult,
  ValidationResult,
  DependencyConflict,
  ModuleDependency,
  ModuleType
} from '../types/registration.js';

export class DefaultDependencyResolver implements DependencyResolver {
  private readonly typeLoadOrder: ModuleType[] = [
    ModuleType.UTILITY,
    ModuleType.SERVER,
    ModuleType.CLIENT,
    ModuleType.PREPROCESSOR,
    ModuleType.PROVIDER,
    ModuleType.TRANSFORMER,
    ModuleType.POST_PROCESSOR,
    ModuleType.ROUTER
  ];

  async resolveDependencies(capabilities: ModuleCapabilities): Promise<ResolutionResult> {
    const resolved: string[] = [];
    const missing: string[] = [];
    const conflicts: DependencyConflict[] = [];

    for (const dependency of capabilities.dependencies) {
      try {
        const resolution = await this.resolveSingleDependency(dependency, capabilities.name);
        
        if (resolution.found) {
          resolved.push(dependency.name);
        } else if (!dependency.optional) {
          missing.push(dependency.name);
        }

        if (resolution.conflicts) {
          conflicts.push(...resolution.conflicts);
        }
      } catch (error) {
        if (!dependency.optional) {
          missing.push(dependency.name);
        }
        
        conflicts.push({
          module: capabilities.name,
          dependency: dependency.name,
          reason: `Resolution failed: ${error.message}`,
          severity: dependency.optional ? 'warning' : 'error'
        });
      }
    }

    return { resolved, missing, conflicts };
  }

  async validateDependencies(modules: ModuleMetadata[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const moduleMap = new Map(modules.map(m => [m.name, m]));

    for (const module of modules) {
      const resolution = await this.resolveDependencies(module.capabilities);
      
      // Check for missing required dependencies
      for (const missing of resolution.missing) {
        errors.push(`Module '${module.name}' has missing required dependency: ${missing}`);
      }

      // Check for conflicts
      for (const conflict of resolution.conflicts) {
        if (conflict.severity === 'error') {
          errors.push(`Module '${module.name}' has dependency conflict: ${conflict.reason}`);
        } else {
          warnings.push(`Module '${module.name}' has dependency warning: ${conflict.reason}`);
        }
      }

      // Check for circular dependencies
      const circularDeps = this.detectCircularDependencies(module, moduleMap, new Set());
      if (circularDeps.length > 0) {
        errors.push(`Module '${module.name}' has circular dependencies: ${circularDeps.join(' -> ')}`);
      }

      // Validate version compatibility
      for (const dep of module.capabilities.dependencies) {
        const depModule = moduleMap.get(dep.name);
        if (depModule && dep.version) {
          const compatible = this.isVersionCompatible(depModule.version, dep.version);
          if (!compatible) {
            const severity = dep.optional ? 'warning' : 'error';
            const message = `Module '${module.name}' requires ${dep.name}@${dep.version} but found ${depModule.version}`;
            
            if (severity === 'error') {
              errors.push(message);
            } else {
              warnings.push(message);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  getLoadOrder(modules: ModuleMetadata[]): string[] {
    const moduleMap = new Map(modules.map(m => [m.name, m]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const loadOrder: string[] = [];

    // Sort modules by type priority first
    const sortedModules = [...modules].sort((a, b) => {
      const aIndex = this.typeLoadOrder.indexOf(a.capabilities.type);
      const bIndex = this.typeLoadOrder.indexOf(b.capabilities.type);
      return aIndex - bIndex;
    });

    for (const module of sortedModules) {
      if (!visited.has(module.name)) {
        this.topologicalSort(module.name, moduleMap, visited, visiting, loadOrder);
      }
    }

    return loadOrder;
  }

  private async resolveSingleDependency(
    dependency: ModuleDependency, 
    requestingModule: string
  ): Promise<{ found: boolean; conflicts?: DependencyConflict[] }> {
    // In a real implementation, this would check the module registry
    // For now, we'll simulate the resolution logic
    
    const conflicts: DependencyConflict[] = [];
    
    // Check type compatibility
    if (dependency.type && !this.isTypeCompatible(dependency.type, requestingModule)) {
      conflicts.push({
        module: requestingModule,
        dependency: dependency.name,
        reason: `Type incompatibility: ${dependency.type} not compatible with requesting module`,
        severity: 'warning'
      });
    }

    // Simulate dependency resolution
    // In real implementation, this would query the module registry
    const found = Math.random() > 0.1; // 90% success rate for simulation

    return { found, conflicts: conflicts.length > 0 ? conflicts : undefined };
  }

  private detectCircularDependencies(
    module: ModuleMetadata,
    moduleMap: Map<string, ModuleMetadata>,
    visited: Set<string>,
    path: string[] = []
  ): string[] {
    if (path.includes(module.name)) {
      return [...path, module.name];
    }

    if (visited.has(module.name)) {
      return [];
    }

    visited.add(module.name);
    const newPath = [...path, module.name];

    for (const dep of module.capabilities.dependencies) {
      const depModule = moduleMap.get(dep.name);
      if (depModule) {
        const circular = this.detectCircularDependencies(depModule, moduleMap, visited, newPath);
        if (circular.length > 0) {
          return circular;
        }
      }
    }

    return [];
  }

  private topologicalSort(
    moduleName: string,
    moduleMap: Map<string, ModuleMetadata>,
    visited: Set<string>,
    visiting: Set<string>,
    result: string[]
  ): void {
    if (visiting.has(moduleName)) {
      throw new Error(`Circular dependency detected involving module: ${moduleName}`);
    }

    if (visited.has(moduleName)) {
      return;
    }

    visiting.add(moduleName);
    const module = moduleMap.get(moduleName);

    if (module) {
      // Visit all dependencies first
      for (const dep of module.capabilities.dependencies) {
        if (moduleMap.has(dep.name)) {
          this.topologicalSort(dep.name, moduleMap, visited, visiting, result);
        }
      }
    }

    visiting.delete(moduleName);
    visited.add(moduleName);
    result.push(moduleName);
  }

  private isVersionCompatible(available: string, required: string): boolean {
    // Simple semantic version compatibility check
    // In a real implementation, this would use a proper semver library
    
    const parseVersion = (version: string) => {
      const cleaned = version.replace(/[^0-9.]/g, '');
      return cleaned.split('.').map(Number);
    };

    try {
      const availableParts = parseVersion(available);
      const requiredParts = parseVersion(required);

      // Major version must match
      if (availableParts[0] !== requiredParts[0]) {
        return false;
      }

      // Minor version must be >= required
      if (availableParts[1] < requiredParts[1]) {
        return false;
      }

      // Patch version must be >= required if minor versions are equal
      if (availableParts[1] === requiredParts[1] && availableParts[2] < requiredParts[2]) {
        return false;
      }

      return true;
    } catch (error) {
      // If version parsing fails, assume compatible
      return true;
    }
  }

  private isTypeCompatible(dependencyType: ModuleType, requestingModule: string): boolean {
    // Define type compatibility rules
    const compatibilityRules: Record<ModuleType, ModuleType[]> = {
      [ModuleType.CLIENT]: [ModuleType.ROUTER, ModuleType.UTILITY],
      [ModuleType.ROUTER]: [ModuleType.POST_PROCESSOR, ModuleType.UTILITY],
      [ModuleType.POST_PROCESSOR]: [ModuleType.TRANSFORMER, ModuleType.UTILITY],
      [ModuleType.TRANSFORMER]: [ModuleType.PROVIDER, ModuleType.UTILITY],
      [ModuleType.PROVIDER]: [ModuleType.PREPROCESSOR, ModuleType.UTILITY],
      [ModuleType.PREPROCESSOR]: [ModuleType.SERVER, ModuleType.UTILITY],
      [ModuleType.SERVER]: [ModuleType.UTILITY],
      [ModuleType.UTILITY]: []
    };

    // For now, assume all types are compatible
    // In a real implementation, this would check the compatibility rules
    return true;
  }
}