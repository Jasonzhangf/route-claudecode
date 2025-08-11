/**
 * Module Discovery System
 * Automatically detects and validates available modules
 */

import { promises as fs } from 'fs';
import { join, dirname, extname } from 'path';
import { pathToFileURL } from 'url';
import {
  ModuleDiscovery,
  DiscoveredModule,
  RegistrableModule,
  ValidationResult,
  ModuleType,
  ModuleCapabilities
} from '../types/registration.js';

export class DefaultModuleDiscovery implements ModuleDiscovery {
  private readonly supportedExtensions = ['.js', '.ts'];
  private readonly modulePatterns = [
    /index\.(js|ts)$/,
    /.*-module\.(js|ts)$/,
    /.*-provider\.(js|ts)$/,
    /.*-layer\.(js|ts)$/
  ];

  async discoverModules(searchPaths: string[]): Promise<DiscoveredModule[]> {
    const discovered: DiscoveredModule[] = [];

    for (const searchPath of searchPaths) {
      try {
        const modules = await this.scanDirectory(searchPath);
        discovered.push(...modules);
      } catch (error) {
        console.warn(`Failed to scan directory ${searchPath}:`, error);
      }
    }

    return discovered;
  }

  async loadModule(path: string): Promise<RegistrableModule> {
    try {
      const fileUrl = pathToFileURL(path).href;
      const moduleExports = await import(fileUrl);
      
      // Try different export patterns
      const module = moduleExports.default || 
                    moduleExports.module || 
                    moduleExports[this.getModuleNameFromPath(path)];

      if (!module) {
        throw new Error(`No valid module export found in ${path}`);
      }

      // If it's a class, instantiate it
      if (typeof module === 'function' && module.prototype) {
        return new module();
      }

      // If it's already an instance
      if (typeof module === 'object' && module.getCapabilities) {
        return module;
      }

      throw new Error(`Invalid module format in ${path}`);
    } catch (error) {
      throw new Error(`Failed to load module from ${path}: ${error.message}`);
    }
  }

  async validateModule(module: RegistrableModule): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check required methods
      if (typeof module.getCapabilities !== 'function') {
        errors.push('Module must implement getCapabilities() method');
      }

      if (typeof module.initialize !== 'function') {
        errors.push('Module must implement initialize() method');
      }

      if (typeof module.shutdown !== 'function') {
        errors.push('Module must implement shutdown() method');
      }

      if (typeof module.healthCheck !== 'function') {
        errors.push('Module must implement healthCheck() method');
      }

      // Validate capabilities if available
      if (typeof module.getCapabilities === 'function') {
        try {
          const capabilities = module.getCapabilities();
          const capabilityValidation = this.validateCapabilities(capabilities);
          errors.push(...capabilityValidation.errors);
          warnings.push(...capabilityValidation.warnings);
        } catch (error) {
          errors.push(`Failed to get module capabilities: ${error.message}`);
        }
      }

    } catch (error) {
      errors.push(`Module validation failed: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async scanDirectory(dirPath: string): Promise<DiscoveredModule[]> {
    const discovered: DiscoveredModule[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subModules = await this.scanDirectory(fullPath);
          discovered.push(...subModules);
        } else if (entry.isFile() && this.isModuleFile(entry.name)) {
          try {
            const module = await this.analyzeModuleFile(fullPath);
            if (module) {
              discovered.push(module);
            }
          } catch (error) {
            discovered.push({
              name: this.getModuleNameFromPath(fullPath),
              path: fullPath,
              type: this.inferModuleType(fullPath),
              version: 'unknown',
              valid: false,
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan directory ${dirPath}: ${error.message}`);
    }

    return discovered;
  }

  private isModuleFile(filename: string): boolean {
    const ext = extname(filename);
    if (!this.supportedExtensions.includes(ext)) {
      return false;
    }

    return this.modulePatterns.some(pattern => pattern.test(filename));
  }

  private async analyzeModuleFile(filePath: string): Promise<DiscoveredModule | null> {
    try {
      // Try to load and validate the module
      const module = await this.loadModule(filePath);
      const validation = await this.validateModule(module);
      
      const capabilities = module.getCapabilities();

      return {
        name: capabilities.name,
        path: filePath,
        type: capabilities.type,
        version: capabilities.version,
        valid: validation.valid,
        error: validation.errors.length > 0 ? validation.errors.join('; ') : undefined
      };
    } catch (error) {
      return {
        name: this.getModuleNameFromPath(filePath),
        path: filePath,
        type: this.inferModuleType(filePath),
        version: 'unknown',
        valid: false,
        error: error.message
      };
    }
  }

  private getModuleNameFromPath(filePath: string): string {
    const filename = filePath.split('/').pop() || '';
    const nameWithoutExt = filename.replace(/\.(js|ts)$/, '');
    
    // Remove common suffixes
    return nameWithoutExt
      .replace(/-module$/, '')
      .replace(/-provider$/, '')
      .replace(/-layer$/, '');
  }

  private inferModuleType(filePath: string): ModuleType {
    const pathLower = filePath.toLowerCase();
    
    if (pathLower.includes('/client/')) return ModuleType.CLIENT;
    if (pathLower.includes('/router/')) return ModuleType.ROUTER;
    if (pathLower.includes('/post-processor/')) return ModuleType.POST_PROCESSOR;
    if (pathLower.includes('/transformer/')) return ModuleType.TRANSFORMER;
    if (pathLower.includes('/provider/')) return ModuleType.PROVIDER;
    if (pathLower.includes('/preprocessor/')) return ModuleType.PREPROCESSOR;
    if (pathLower.includes('/server/')) return ModuleType.SERVER;
    
    return ModuleType.UTILITY;
  }

  private validateCapabilities(capabilities: ModuleCapabilities): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!capabilities.name || typeof capabilities.name !== 'string') {
      errors.push('Module capabilities must include a valid name');
    }

    if (!capabilities.version || typeof capabilities.version !== 'string') {
      errors.push('Module capabilities must include a valid version');
    }

    if (!Object.values(ModuleType).includes(capabilities.type)) {
      errors.push(`Invalid module type: ${capabilities.type}`);
    }

    if (!Array.isArray(capabilities.supportedFormats)) {
      warnings.push('Module capabilities should include supportedFormats array');
    }

    if (!Array.isArray(capabilities.features)) {
      warnings.push('Module capabilities should include features array');
    }

    if (!Array.isArray(capabilities.dependencies)) {
      warnings.push('Module capabilities should include dependencies array');
    }

    if (!Array.isArray(capabilities.interfaces)) {
      warnings.push('Module capabilities should include interfaces array');
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}