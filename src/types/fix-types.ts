// src/types/fix-types.ts
export interface FixStrategy {
  type: 'add_field' | 'update_value' | 'modify_structure' | 'update_config';
  path: string;
  target: 'transformer' | 'protocol' | 'compatibility' | 'server';
  priority: 'high' | 'medium' | 'low';
  value?: any;
  oldValue?: any;
  newValue?: any;
  description?: string;
}

export interface ConfigurationUpdate {
  operation: 'add_field' | 'update_mapping' | 'remove_field' | 'update_config';
  fieldPath: string;
  fieldValue?: any;
  oldValue?: any;
  newValue?: any;
}

export interface CodeModification {
  operation: 'add_function' | 'modify_function' | 'modify_structure' | 'remove_code';
  filePath: string;
  functionName?: string;
  description?: string;
  newCode?: string;
}