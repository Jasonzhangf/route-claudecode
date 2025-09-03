/**
 * 测试数据管理器
 * 
 * 负责测试数据的生成、加载、验证和清理
 * 
 * @author RCC Test Framework
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// 测试数据模式接口
export interface TestDataSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, any>;
  items?: TestDataSchema;
  required?: string[];
  examples?: any[];
}

// 测试数据接口
export interface TestData {
  id: string;
  name: string;
  data: any;
  schema: TestDataSchema;
  createdAt: string;
  tags: string[];
}

// 测试数据源接口
export interface TestDataSource {
  type: 'file' | 'database' | 'api' | 'generated';
  location: string;
  format: 'json' | 'csv' | 'xml';
}

// 清理条件接口
export interface CleanupCriteria {
  olderThan?: string; // ISO date string
  tags?: string[];
  namePattern?: string;
}

// 验证结果接口
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// 数据生成配置
export interface DataGenerationConfig {
  count: number;
  locale?: string;
  seed?: number;
}

/**
 * 测试数据管理器类
 */
export class TestDataManager {
  private dataStoragePath: string;
  private dataCache: Map<string, TestData>;

  constructor(storagePath: string = './test-data') {
    this.dataStoragePath = storagePath;
    this.dataCache = new Map();
    this.ensureStorageDirectory();
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.dataStoragePath)) {
      fs.mkdirSync(this.dataStoragePath, { recursive: true });
    }
  }

  /**
   * 生成测试数据
   * @param schema 数据模式
   * @param config 生成配置
   * @param name 数据名称
   * @returns 生成的测试数据
   */
  async generateTestData(
    schema: TestDataSchema,
    config: DataGenerationConfig = { count: 1 },
    name: string = `test-data-${Date.now()}`
  ): Promise<TestData[]> {
    try {
      const testDataArray: TestData[] = [];

      for (let i = 0; i < config.count; i++) {
        const testData: TestData = {
          id: uuidv4(),
          name: `${name}-${i}`,
          data: this.generateDataFromSchema(schema, config.seed ? config.seed + i : undefined),
          schema,
          createdAt: new Date().toISOString(),
          tags: ['generated']
        };

        // 缓存数据
        this.dataCache.set(testData.id, testData);
        
        // 保存到文件系统
        this.saveTestDataToFile(testData);
        
        testDataArray.push(testData);
      }

      return testDataArray;
    } catch (error) {
      throw new Error(`Failed to generate test data: ${error.message}`);
    }
  }

  /**
   * 根据模式生成数据
   * @param schema 数据模式
   * @param seed 随机种子
   * @returns 生成的数据
   */
  private generateDataFromSchema(schema: TestDataSchema, seed?: number): any {
    // 设置随机种子（如果提供）
    if (seed !== undefined) {
      // 注意：这里简化处理，实际项目中可能需要更复杂的随机数生成器
      // Math.seed = seed; // 注释掉不支持的代码
    }

    switch (schema.type) {
      case 'object':
        const obj: Record<string, any> = {};
        if (schema.properties) {
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            obj[key] = this.generateDataFromSchema(propSchema as TestDataSchema, seed);
          }
        }
        return obj;

      case 'array':
        const arr: any[] = [];
        const itemCount = Math.floor(Math.random() * 10) + 1; // 1-10个元素
        for (let i = 0; i < itemCount; i++) {
          if (schema.items) {
            arr.push(this.generateDataFromSchema(schema.items, seed ? seed + i : undefined));
          }
        }
        return arr;

      case 'string':
        return this.generateRandomString(seed);

      case 'number':
        return Math.random() * 1000;

      case 'boolean':
        return Math.random() > 0.5;

      default:
        return null;
    }
  }

  /**
   * 生成随机字符串
   * @param seed 随机种子
   * @returns 随机字符串
   */
  private generateRandomString(seed?: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const length = Math.floor(Math.random() * 20) + 5; // 5-25个字符

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  /**
   * 从数据源加载测试数据
   * @param source 数据源
   * @returns 加载的测试数据
   */
  async loadTestData(source: TestDataSource): Promise<TestData[]> {
    try {
      let testDataArray: TestData[] = [];

      switch (source.type) {
        case 'file':
          testDataArray = await this.loadFromFile(source.location, source.format);
          break;

        case 'generated':
          // 对于已生成的数据，直接从缓存或文件系统加载
          testDataArray = await this.loadGeneratedData(source.location);
          break;

        default:
          throw new Error(`Unsupported data source type: ${source.type}`);
      }

      // 缓存加载的数据
      testDataArray.forEach(data => {
        this.dataCache.set(data.id, data);
      });

      return testDataArray;
    } catch (error) {
      throw new Error(`Failed to load test data: ${error.message}`);
    }
  }

  /**
   * 从文件加载数据
   * @param filePath 文件路径
   * @param format 文件格式
   * @returns 测试数据数组
   */
  private async loadFromFile(filePath: string, format: string): Promise<TestData[]> {
    try {
      const fullPath = path.resolve(filePath);
      const fileContent = fs.readFileSync(fullPath, 'utf8');

      switch (format) {
        case 'json':
          return JSON.parse(fileContent);

        case 'csv':
          return this.parseCSV(fileContent);

        default:
          throw new Error(`Unsupported file format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to load data from file ${filePath}: ${error.message}`);
    }
  }

  /**
   * 解析CSV数据
   * @param csvContent CSV内容
   * @returns 测试数据数组
   */
  private parseCSV(csvContent: string): TestData[] {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    
    const testDataArray: TestData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      
      const values = lines[i].split(',');
      const obj: Record<string, any> = {};
      
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j].trim()] = values[j] ? values[j].trim() : '';
      }
      
      const testData: TestData = {
        id: uuidv4(),
        name: `csv-data-${i}`,
        data: obj,
        schema: { type: 'object' },
        createdAt: new Date().toISOString(),
        tags: ['csv-import']
      };
      
      testDataArray.push(testData);
    }
    
    return testDataArray;
  }

  /**
   * 加载已生成的数据
   * @param location 数据位置标识
   * @returns 测试数据数组
   */
  private async loadGeneratedData(location: string): Promise<TestData[]> {
    // 首先检查缓存
    if (this.dataCache.has(location)) {
      return [this.dataCache.get(location)!];
    }

    // 然后检查文件系统
    const filePath = path.join(this.dataStoragePath, `${location}.json`);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return [JSON.parse(fileContent)];
    }

    return [];
  }

  /**
   * 保存测试数据到文件
   * @param testData 测试数据
   */
  private saveTestDataToFile(testData: TestData): void {
    try {
      const filePath = path.join(this.dataStoragePath, `${testData.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
    } catch (error) {
      console.warn(`Failed to save test data to file: ${error.message}`);
    }
  }

  /**
   * 验证测试数据
   * @param data 测试数据
   * @param schema 数据模式
   * @returns 验证结果
   */
  async validateTestData(data: TestData, schema: TestDataSchema): Promise<ValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // 基本验证
      if (!data.id) {
        errors.push('Missing required field: id');
      }

      if (!data.name) {
        errors.push('Missing required field: name');
      }

      if (!data.data) {
        errors.push('Missing required field: data');
      }

      if (!data.schema) {
        warnings.push('Missing schema definition');
      }

      // 数据类型验证
      if (schema.type === 'object' && typeof data.data !== 'object') {
        errors.push(`Expected object data, got ${typeof data.data}`);
      }

      if (schema.type === 'array' && !Array.isArray(data.data)) {
        errors.push(`Expected array data, got ${typeof data.data}`);
      }

      if (schema.type === 'string' && typeof data.data !== 'string') {
        errors.push(`Expected string data, got ${typeof data.data}`);
      }

      if (schema.type === 'number' && typeof data.data !== 'number') {
        errors.push(`Expected number data, got ${typeof data.data}`);
      }

      if (schema.type === 'boolean' && typeof data.data !== 'boolean') {
        errors.push(`Expected boolean data, got ${typeof data.data}`);
      }

      // 属性验证（仅对对象类型）
      if (schema.type === 'object' && schema.properties && typeof data.data === 'object') {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (schema.required && schema.required.includes(propName) && !(propName in data.data)) {
            errors.push(`Missing required property: ${propName}`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * 清理测试数据
   * @param criteria 清理条件
   */
  async cleanupTestData(criteria: CleanupCriteria): Promise<void> {
    try {
      // 从缓存中清理
      for (const [id, data] of this.dataCache.entries()) {
        if (this.shouldCleanupData(data, criteria)) {
          this.dataCache.delete(id);
        }
      }

      // 从文件系统中清理
      if (fs.existsSync(this.dataStoragePath)) {
        const files = fs.readdirSync(this.dataStoragePath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.dataStoragePath, file);
            try {
              const fileContent = fs.readFileSync(filePath, 'utf8');
              const testData: TestData = JSON.parse(fileContent);
              
              if (this.shouldCleanupData(testData, criteria)) {
                fs.unlinkSync(filePath);
              }
            } catch (error) {
              console.warn(`Failed to process file ${file}: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to cleanup test data: ${error.message}`);
    }
  }

  /**
   * 判断是否应该清理数据
   * @param data 测试数据
   * @param criteria 清理条件
   * @returns 是否应该清理
   */
  private shouldCleanupData(data: TestData, criteria: CleanupCriteria): boolean {
    // 按时间清理
    if (criteria.olderThan) {
      const dataDate = new Date(data.createdAt);
      const criteriaDate = new Date(criteria.olderThan);
      if (dataDate < criteriaDate) {
        return true;
      }
    }

    // 按标签清理
    if (criteria.tags && criteria.tags.length > 0) {
      if (data.tags.some(tag => criteria.tags!.includes(tag))) {
        return true;
      }
    }

    // 按名称模式清理
    if (criteria.namePattern) {
      const regex = new RegExp(criteria.namePattern);
      if (regex.test(data.name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取所有测试数据ID
   * @returns 测试数据ID列表
   */
  async getAllTestDataIds(): Promise<string[]> {
    // 从缓存获取
    const cacheIds = Array.from(this.dataCache.keys());
    
    // 从文件系统获取
    const fileIds: string[] = [];
    if (fs.existsSync(this.dataStoragePath)) {
      const files = fs.readdirSync(this.dataStoragePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const fileId = path.basename(file, '.json');
          if (!cacheIds.includes(fileId)) {
            fileIds.push(fileId);
          }
        }
      }
    }
    
    return [...new Set([...cacheIds, ...fileIds])];
  }

  /**
   * 根据ID获取测试数据
   * @param id 数据ID
   * @returns 测试数据
   */
  async getTestDataById(id: string): Promise<TestData | null> {
    // 首先从缓存获取
    if (this.dataCache.has(id)) {
      return this.dataCache.get(id)!;
    }

    // 然后从文件系统获取
    const filePath = path.join(this.dataStoragePath, `${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const testData: TestData = JSON.parse(fileContent);
        this.dataCache.set(id, testData); // 缓存数据
        return testData;
      } catch (error) {
        console.warn(`Failed to load test data from file ${filePath}: ${error.message}`);
      }
    }

    return null;
  }
}

// 导出类型定义
export default TestDataManager;