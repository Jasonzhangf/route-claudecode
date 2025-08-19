/**
 * Global Error Handler Middleware
 *
 * 全局错误处理中间件，确保所有模块在遇到未定义属性访问时能优雅地处理
 *
 * @author Claude Code
 * @version 1.0.0
 */

import { secureLogger } from '../utils/secure-logger';

/**
 * 全局错误处理器类
 */
export class GlobalErrorHandler {
  /**
   * 处理未定义属性访问错误
   */
  static handleUndefinedPropertyAccess(obj: any, property: string, context: string): any {
    if (obj === undefined || obj === null) {
      secureLogger.error('❌ 尝试访问未定义对象的属性', {
        object: obj,
        property,
        context,
        stack: new Error().stack,
      });

      // 返回安全的默认值而不是抛出错误
      return undefined;
    }

    if (!(property in obj)) {
      secureLogger.warn('⚠️ 尝试访问对象中不存在的属性', {
        object: typeof obj,
        property,
        context,
        availableProperties: Object.keys(obj),
      });

      // 返回安全的默认值而不是抛出错误
      return undefined;
    }

    return obj[property];
  }

  /**
   * 安全地访问嵌套属性
   */
  static safeGet(obj: any, path: string, defaultValue: any = undefined): any {
    try {
      const keys = path.split('.');
      let current = obj;

      for (const key of keys) {
        if (current === undefined || current === null) {
          return defaultValue;
        }

        if (!(key in current)) {
          return defaultValue;
        }

        current = current[key];
      }

      return current;
    } catch (error) {
      secureLogger.error('❌ 安全访问嵌套属性时出错', {
        path,
        object: typeof obj,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      return defaultValue;
    }
  }

  /**
   * 安全地调用数组方法
   */
  static safeArrayMethod(arr: any, method: string, ...args: any[]): any {
    if (!Array.isArray(arr)) {
      secureLogger.warn('⚠️ 尝试对非数组对象调用数组方法', {
        array: typeof arr,
        method,
        args,
      });

      // 返回安全的默认值
      if (method === 'filter') return [];
      if (method === 'map') return [];
      if (method === 'forEach') return undefined;
      if (method === 'reduce') return args[1]; // 返回初始值
      if (method === 'find') return undefined;
      if (method === 'some') return false;
      if (method === 'every') return true;

      return undefined;
    }

    try {
      // @ts-ignore
      return arr[method](...args);
    } catch (error) {
      secureLogger.error('❌ 调用数组方法时出错', {
        method,
        arrayLength: arr.length,
        args,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      // 返回安全的默认值
      if (method === 'filter') return [];
      if (method === 'map') return [];
      if (method === 'forEach') return undefined;
      if (method === 'reduce') return args[1]; // 返回初始值
      if (method === 'find') return undefined;
      if (method === 'some') return false;
      if (method === 'every') return true;

      return undefined;
    }
  }

  /**
   * 创建安全的数组包装器
   */
  static createSafeArrayWrapper<T>(arr: T[] | undefined | null): SafeArrayWrapper<T> {
    return new SafeArrayWrapper(arr);
  }

  /**
   * 创建安全的对象包装器
   */
  static createSafeObjectWrapper(obj: any): SafeObjectWrapper {
    return new SafeObjectWrapper(obj);
  }
}

/**
 * 安全数组包装器类
 */
export class SafeArrayWrapper<T> {
  private array: T[];

  constructor(arr: T[] | undefined | null) {
    this.array = Array.isArray(arr) ? arr : [];
  }

  /**
   * 安全的filter方法
   */
  filter(callbackfn: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[] {
    try {
      return this.array.filter(callbackfn, thisArg);
    } catch (error) {
      secureLogger.error('❌ 安全filter方法调用失败', {
        arrayLength: this.array.length,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return [];
    }
  }

  /**
   * 安全的map方法
   */
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[] {
    try {
      return this.array.map(callbackfn, thisArg);
    } catch (error) {
      secureLogger.error('❌ 安全map方法调用失败', {
        arrayLength: this.array.length,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return [];
    }
  }

  /**
   * 安全的forEach方法
   */
  forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): void {
    try {
      this.array.forEach(callbackfn, thisArg);
    } catch (error) {
      secureLogger.error('❌ 安全forEach方法调用失败', {
        arrayLength: this.array.length,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    }
  }

  /**
   * 安全的reduce方法
   */
  reduce<U>(
    callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U,
    initialValue: U
  ): U {
    try {
      return this.array.reduce(callbackfn, initialValue);
    } catch (error) {
      secureLogger.error('❌ 安全reduce方法调用失败', {
        arrayLength: this.array.length,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return initialValue;
    }
  }

  /**
   * 安全的find方法
   */
  find(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined {
    try {
      return this.array.find(predicate, thisArg);
    } catch (error) {
      secureLogger.error('❌ 安全find方法调用失败', {
        arrayLength: this.array.length,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return undefined;
    }
  }

  /**
   * 安全的some方法
   */
  some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
    try {
      return this.array.some(predicate, thisArg);
    } catch (error) {
      secureLogger.error('❌ 安全some方法调用失败', {
        arrayLength: this.array.length,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return false;
    }
  }

  /**
   * 安全的every方法
   */
  every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
    try {
      return this.array.every(predicate, thisArg);
    } catch (error) {
      secureLogger.error('❌ 安全every方法调用失败', {
        arrayLength: this.array.length,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return true;
    }
  }

  /**
   * 获取数组长度
   */
  get length(): number {
    return this.array.length;
  }

  /**
   * 获取数组元素
   */
  get(index: number): T | undefined {
    return this.array[index];
  }

  /**
   * 转换为普通数组
   */
  toArray(): T[] {
    return [...this.array];
  }
}

/**
 * 安全对象包装器类
 */
export class SafeObjectWrapper {
  private obj: any;

  constructor(obj: any) {
    this.obj = obj && typeof obj === 'object' ? obj : {};
  }

  /**
   * 安全地获取属性值
   */
  get(property: string, defaultValue: any = undefined): any {
    if (this.obj === undefined || this.obj === null) {
      return defaultValue;
    }

    if (!(property in this.obj)) {
      return defaultValue;
    }

    return this.obj[property];
  }

  /**
   * 安全地设置属性值
   */
  set(property: string, value: any): void {
    if (this.obj === undefined || this.obj === null) {
      secureLogger.warn('⚠️ 尝试对未定义对象设置属性', {
        property,
        value,
      });
      return;
    }

    this.obj[property] = value;
  }

  /**
   * 检查属性是否存在
   */
  has(property: string): boolean {
    if (this.obj === undefined || this.obj === null) {
      return false;
    }

    return property in this.obj;
  }

  /**
   * 获取所有属性名
   */
  keys(): string[] {
    if (this.obj === undefined || this.obj === null) {
      return [];
    }

    return Object.keys(this.obj);
  }

  /**
   * 获取所有属性值
   */
  values(): any[] {
    if (this.obj === undefined || this.obj === null) {
      return [];
    }

    return Object.values(this.obj);
  }

  /**
   * 转换为普通对象
   */
  toObject(): any {
    return { ...this.obj };
  }
}

// 导出便捷函数
export const safeFilter = <T>(
  arr: T[] | undefined | null,
  callbackfn: (value: T, index: number, array: T[]) => unknown,
  thisArg?: any
): T[] => {
  return GlobalErrorHandler.createSafeArrayWrapper(arr).filter(callbackfn, thisArg);
};

export const safeMap = <T, U>(
  arr: T[] | undefined | null,
  callbackfn: (value: T, index: number, array: T[]) => U,
  thisArg?: any
): U[] => {
  return GlobalErrorHandler.createSafeArrayWrapper(arr).map(callbackfn, thisArg);
};

export const safeForEach = <T>(
  arr: T[] | undefined | null,
  callbackfn: (value: T, index: number, array: T[]) => void,
  thisArg?: any
): void => {
  GlobalErrorHandler.createSafeArrayWrapper(arr).forEach(callbackfn, thisArg);
};

export const safeReduce = <T, U>(
  arr: T[] | undefined | null,
  callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U,
  initialValue: U
): U => {
  return GlobalErrorHandler.createSafeArrayWrapper(arr).reduce(callbackfn, initialValue);
};

export const safeFind = <T>(
  arr: T[] | undefined | null,
  predicate: (value: T, index: number, obj: T[]) => unknown,
  thisArg?: any
): T | undefined => {
  return GlobalErrorHandler.createSafeArrayWrapper(arr).find(predicate, thisArg);
};

export const safeSome = <T>(
  arr: T[] | undefined | null,
  predicate: (value: T, index: number, array: T[]) => unknown,
  thisArg?: any
): boolean => {
  return GlobalErrorHandler.createSafeArrayWrapper(arr).some(predicate, thisArg);
};

export const safeEvery = <T>(
  arr: T[] | undefined | null,
  predicate: (value: T, index: number, array: T[]) => unknown,
  thisArg?: any
): boolean => {
  return GlobalErrorHandler.createSafeArrayWrapper(arr).every(predicate, thisArg);
};

export const safeGet = (obj: any, path: string, defaultValue: any = undefined): any => {
  return GlobalErrorHandler.safeGet(obj, path, defaultValue);
};

export const safeArrayMethod = (arr: any, method: string, ...args: any[]): any => {
  return GlobalErrorHandler.safeArrayMethod(arr, method, ...args);
};
