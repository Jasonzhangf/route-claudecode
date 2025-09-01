// 测试类型定义
export interface TestCase {
  id: string;
  name: string;
  description?: string;
  execute: () => Promise<void> | void;
  before?: () => Promise<void> | void;
  after?: () => Promise<void> | void;
  tags?: string[];
  timeout?: number;
}

export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  testCases: TestCase[];
  beforeAll?: () => Promise<void> | void;
  afterAll?: () => Promise<void> | void;
  tags?: string[];
}

export interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number; // milliseconds
  timestamp: Date;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pending: number;
    duration: number; // total duration in milliseconds
  };
  results: TestResult[];
  timestamp: Date;
  environment: string;
}