// src/services/configuration-updater.ts
import { ConfigurationUpdate } from '../types/fix-types';
import JQJsonHandler from '../modules/error-handler/src/utils/jq-json-handler';

export class ConfigurationUpdater {
  async updateTransformerConfig(update: ConfigurationUpdate): Promise<void> {
    const configPath = './config/transformer-config.json';
    const config = await this.loadConfig(configPath);
    
    switch (update.operation) {
      case 'add_field':
        this.addFieldToConfig(config, update.fieldPath, update.fieldValue);
        break;
      case 'update_mapping':
        this.updateFieldMapping(config, update.fieldPath, update.oldValue, update.newValue);
        break;
    }
    
    await this.saveConfig(configPath, config);
  }
  
  async updateCompatibilityConfig(update: ConfigurationUpdate): Promise<void> {
    const configPath = './config/compatibility-config.json';
    const config = await this.loadConfig(configPath);
    
    switch (update.operation) {
      case 'add_field':
        this.addFieldToConfig(config, update.fieldPath, update.fieldValue);
        break;
      case 'update_mapping':
        this.updateFieldMapping(config, update.fieldPath, update.oldValue, update.newValue);
        break;
    }
    
    await this.saveConfig(configPath, config);
  }
  
  private async loadConfig(configPath: string): Promise<any> {
    const fs = require('fs').promises;
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  }
  
  private async saveConfig(configPath: string, config: any): Promise<void> {
    const fs = require('fs').promises;
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }
  
  private addFieldToConfig(config: any, fieldPath: string, fieldValue: any): void {
    // 实现字段添加逻辑
    const pathParts = fieldPath.split('.');
    let current = config;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }
    
    current[pathParts[pathParts.length - 1]] = fieldValue;
  }
  
  private updateFieldMapping(config: any, fieldPath: string, oldValue: any, newValue: any): void {
    // 实现字段映射更新逻辑
    const pathParts = fieldPath.split('.');
    let current = config;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }
    
    const fieldName = pathParts[pathParts.length - 1];
    if (current[fieldName] === oldValue) {
      current[fieldName] = newValue;
    }
  }
}