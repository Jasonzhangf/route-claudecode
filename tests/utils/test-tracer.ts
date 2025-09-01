// 分布式追踪系统
import { v4 as uuidv4 } from 'uuid';
import { testLogger } from './test-logger';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes?: Record<string, any>;
  status?: 'unset' | 'ok' | 'error';
  error?: Error;
}

export class Tracer {
  private activeSpans: Map<string, TraceContext> = new Map();
  
  // 创建新的追踪上下文
  startSpan(name: string, parentContext?: TraceContext): TraceContext {
    const traceId = parentContext?.traceId || uuidv4();
    const spanId = uuidv4();
    
    const span: TraceContext = {
      traceId,
      spanId,
      parentSpanId: parentContext?.spanId,
      name,
      startTime: Date.now(),
      attributes: {},
      status: 'unset'
    };
    
    this.activeSpans.set(spanId, span);
    testLogger.debug(`Started span: ${name}`, { traceId, spanId }, traceId);
    
    return span;
  }
  
  // 结束追踪上下文
  endSpan(span: TraceContext, error?: Error): void {
    span.endTime = Date.now();
    
    if (error) {
      span.status = 'error';
      span.error = error;
    } else {
      span.status = 'ok';
    }
    
    this.activeSpans.delete(span.spanId);
    
    const duration = span.endTime - span.startTime;
    testLogger.debug(`Ended span: ${span.name}`, { 
      traceId: span.traceId, 
      spanId: span.spanId, 
      duration,
      status: span.status
    }, span.traceId);
  }
  
  // 添加属性到追踪上下文
  setAttribute(span: TraceContext, key: string, value: any): void {
    if (!span.attributes) {
      span.attributes = {};
    }
    span.attributes[key] = value;
  }
  
  // 添加多个属性到追踪上下文
  setAttributes(span: TraceContext, attributes: Record<string, any>): void {
    if (!span.attributes) {
      span.attributes = {};
    }
    Object.assign(span.attributes, attributes);
  }
  
  // 获取追踪上下文
  getSpan(spanId: string): TraceContext | undefined {
    return this.activeSpans.get(spanId);
  }
  
  // 获取所有活跃的追踪上下文
  getActiveSpans(): TraceContext[] {
    return Array.from(this.activeSpans.values());
  }
}

// 全局追踪器实例
export const tracer = new Tracer();

// 测试执行追踪装饰器
export function traceTest(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const span = tracer.startSpan(`test:${propertyName}`);
    
    try {
      const result = method.apply(this, args);
      
      if (result instanceof Promise) {
        return result.then((res) => {
          tracer.endSpan(span);
          return res;
        }).catch((error) => {
          tracer.endSpan(span, error);
          throw error;
        });
      } else {
        tracer.endSpan(span);
        return result;
      }
    } catch (error) {
      tracer.endSpan(span, error as Error);
      throw error;
    }
  };
}