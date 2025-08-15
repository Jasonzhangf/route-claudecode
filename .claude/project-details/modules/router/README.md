# 路由器模块 (Router Module)

## 模块概述

路由器模块负责配置管理、请求路由和流水线生命周期管理，是系统的核心调度中心。

## 目录结构

```
src/router/
├── README.md                    # 路由器模块文档
├── index.ts                     # 路由器模块入口
├── router-manager.ts            # 路由器管理器
├── config-manager.ts            # 配置管理
├── request-router.ts            # 请求路由
├── pipeline-manager.ts          # 流水线管理
├── session-flow-controller.ts   # 会话流控管理器
└── types/                       # 路由器相关类型
    ├── config-types.ts          # 配置相关类型
    ├── routing-types.ts         # 路由相关类型
    ├── pipeline-types.ts        # 流水线相关类型
    └── session-types.ts         # 会话流控类型
```

## 核心功能

### 1. 配置管理系统
- 读取 `~/.route-claudecode/config` 下的配置文件
- Provider List 管理
- Routing Table 管理
- 动态配置重载
- 环境变量替换

### 2. 请求路由系统
- 智能请求分类（default/think/longContext/background/webSearch）
- 根据权重进行负载均衡
- 健康状态检查
- 动态路由表生成
- 会话流控管理（基于session.conversationID.requestID）

### 3. 流水线管理
- 动态创建和销毁流水线
- 流水线健康监控
- 生命周期管理
- 负载均衡调度

### 4. 会话流控系统
- 会话级别的请求排队
- 对话内请求顺序保证
- 并发控制和资源管理
- 请求优先级调度

## 路由分类逻辑

### 请求分类规则
```typescript
interface RequestCategory {
  default: "常规对话请求";
  think: "需要深度思考的复杂问题";
  longContext: "长上下文处理请求";
  background: "后台处理任务";
  webSearch: "需要网络搜索的请求";
}
```

### 负载均衡策略
- 权重轮询 (Weighted Round Robin)
- 健康状态感知 (Health Aware)
- 响应时间优化 (Response Time Based)
- 配额感知 (Quota Aware)

## 配置文件格式

### Provider配置
```json
{
  "providers": [
    {
      "name": "openai",
      "protocol": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "${OPENAI_API_KEY}",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "maxTokens": 4096,
      "availability": true
    }
  ]
}
```

### 路由配置
```json
{
  "routes": [
    {
      "category": "default",
      "rules": [
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 0.7
        }
      ]
    }
  ]
}
```

## 接口定义

```typescript
export interface RouterModule {
  initialize(): Promise<void>;
  processRequest(request: RCCRequest): Promise<RCCResponse>;
  getProviderConfigs(): Promise<ProviderConfig[]>;
  updateProviderConfig(provider: string, config: ProviderConfig): Promise<void>;
}

export interface ConfigManager {
  loadProviderConfig(): Promise<ProviderConfig[]>;
  loadRoutingConfig(): Promise<RoutingConfig>;
  generateRoutingTable(): Promise<GeneratedRoutingTable>;
  watchConfigChanges(): void;
}

export interface RequestRouter {
  route(request: RCCRequest): Promise<Pipeline>;
  selectPipeline(category: string): Promise<Pipeline>;
  balanceLoad(pipelines: Pipeline[]): Pipeline;
}

export interface PipelineManager {
  createPipeline(provider: string, model: string): Promise<Pipeline>;
  destroyPipeline(pipelineId: string): Promise<void>;
  getPipeline(pipelineId: string): Pipeline | null;
  listActivePipelines(): Pipeline[];
  monitorAvailability(): void;
}

export interface SessionFlowController {
  enqueueRequest(sessionId: string, conversationId: string, request: RCCRequest): Promise<string>;
  processNextRequest(sessionId: string, conversationId: string): Promise<RCCResponse | null>;
  getQueueStatus(sessionId: string, conversationId?: string): QueueStatus;
  cancelRequest(sessionId: string, conversationId: string, requestId: string): boolean;
  cleanupSession(sessionId: string): void;
}
```

## 错误处理

### 错误类型
- ROUTER_ERROR: 路由处理错误
- CONFIG_ERROR: 配置文件错误
- PIPELINE_ERROR: 流水线管理错误

### 处理原则
- 使用标准API error handler
- 配置错误时提供具体错误位置
- 流水线故障时自动切换备用方案
- 完整的错误上下文记录

## 会话流控系统设计

### 流控架构
```
Session Level (会话级别)
├── Conversation Level (对话级别)
│   ├── Request Queue (请求队列)
│   │   ├── requestID_001 (按顺序处理)
│   │   ├── requestID_002
│   │   └── requestID_003
│   └── Processing State (处理状态)
└── Resource Management (资源管理)
```

### 会话流控管理器实现
```typescript
// src/router/session-flow-controller.ts
export class SessionFlowController implements SessionFlowController {
  private sessionQueues: Map<string, SessionQueue> = new Map();
  private processingRequests: Map<string, ProcessingRequest> = new Map();
  private maxConcurrentSessions: number = 100;
  private maxRequestsPerConversation: number = 50;

  async enqueueRequest(
    sessionId: string, 
    conversationId: string, 
    request: RCCRequest
  ): Promise<string> {
    const requestId = this.generateRequestId();
    const queueKey = `${sessionId}.${conversationId}`;
    
    // 获取或创建会话队列
    let sessionQueue = this.sessionQueues.get(sessionId);
    if (!sessionQueue) {
      sessionQueue = new SessionQueue(sessionId, this.maxRequestsPerConversation);
      this.sessionQueues.set(sessionId, sessionQueue);
    }

    // 将请求加入对话队列
    const queuedRequest: QueuedRequest = {
      requestId,
      sessionId,
      conversationId,
      request,
      enqueuedAt: Date.now(),
      enqueuedAtReadable: new Date().toLocaleString(),
      priority: this.calculatePriority(request),
      status: 'queued'
    };

    await sessionQueue.enqueueRequest(conversationId, queuedRequest);
    
    // 触发处理
    this.processSessionQueue(sessionId);
    
    return requestId;
  }

  async processNextRequest(
    sessionId: string, 
    conversationId: string
  ): Promise<RCCResponse | null> {
    const sessionQueue = this.sessionQueues.get(sessionId);
    if (!sessionQueue) {
      return null;
    }

    const queuedRequest = await sessionQueue.dequeueRequest(conversationId);
    if (!queuedRequest) {
      return null;
    }

    try {
      // 标记为处理中
      const processingKey = `${sessionId}.${conversationId}.${queuedRequest.requestId}`;
      this.processingRequests.set(processingKey, {
        ...queuedRequest,
        status: 'processing',
        startedAt: Date.now(),
        startedAtReadable: new Date().toLocaleString()
      });

      // 通过路由器处理请求
      const response = await this.routeRequest(queuedRequest.request);
      
      // 清理处理记录
      this.processingRequests.delete(processingKey);
      
      return response;
    } catch (error) {
      // 处理失败，清理记录
      const processingKey = `${sessionId}.${conversationId}.${queuedRequest.requestId}`;
      this.processingRequests.delete(processingKey);
      throw error;
    }
  }

  getQueueStatus(sessionId: string, conversationId?: string): QueueStatus {
    const sessionQueue = this.sessionQueues.get(sessionId);
    if (!sessionQueue) {
      return {
        sessionId,
        exists: false,
        totalQueued: 0,
        totalProcessing: 0,
        conversations: []
      };
    }

    if (conversationId) {
      // 返回特定对话的状态
      const conversationQueue = sessionQueue.getConversationQueue(conversationId);
      return {
        sessionId,
        conversationId,
        exists: true,
        totalQueued: conversationQueue?.queuedRequests.length || 0,
        totalProcessing: conversationQueue?.processingCount || 0,
        conversations: [{
          conversationId,
          queuedCount: conversationQueue?.queuedRequests.length || 0,
          processingCount: conversationQueue?.processingCount || 0,
          lastActivity: conversationQueue?.lastActivity
        }]
      };
    }

    // 返回整个会话的状态
    return sessionQueue.getStatus();
  }

  cancelRequest(sessionId: string, conversationId: string, requestId: string): boolean {
    const sessionQueue = this.sessionQueues.get(sessionId);
    if (!sessionQueue) {
      return false;
    }

    // 尝试从队列中移除
    const removed = sessionQueue.removeRequest(conversationId, requestId);
    if (removed) {
      return true;
    }

    // 尝试取消正在处理的请求
    const processingKey = `${sessionId}.${conversationId}.${requestId}`;
    if (this.processingRequests.has(processingKey)) {
      this.processingRequests.delete(processingKey);
      return true;
    }

    return false;
  }

  cleanupSession(sessionId: string): void {
    // 清理会话队列
    this.sessionQueues.delete(sessionId);
    
    // 清理相关的处理请求
    for (const [key, request] of this.processingRequests.entries()) {
      if (request.sessionId === sessionId) {
        this.processingRequests.delete(key);
      }
    }
  }

  private async processSessionQueue(sessionId: string): Promise<void> {
    const sessionQueue = this.sessionQueues.get(sessionId);
    if (!sessionQueue) {
      return;
    }

    // 获取所有有待处理请求的对话
    const conversationsWithRequests = sessionQueue.getConversationsWithRequests();
    
    for (const conversationId of conversationsWithRequests) {
      // 检查该对话是否已有请求在处理中
      const hasProcessingRequest = Array.from(this.processingRequests.values())
        .some(req => req.sessionId === sessionId && req.conversationId === conversationId);
      
      if (!hasProcessingRequest) {
        // 异步处理下一个请求
        this.processNextRequest(sessionId, conversationId)
          .catch(error => {
            console.error(`Failed to process request for ${sessionId}.${conversationId}:`, error);
          });
      }
    }
  }

  private calculatePriority(request: RCCRequest): number {
    // 根据请求类型计算优先级
    const category = this.classifyRequest(request);
    const priorityMap = {
      'default': 5,
      'think': 3,
      'longContext': 2,
      'background': 1,
      'webSearch': 4
    };
    
    return priorityMap[category] || 5;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 会话队列实现
```typescript
// src/router/session-queue.ts
class SessionQueue {
  private sessionId: string;
  private conversationQueues: Map<string, ConversationQueue> = new Map();
  private maxRequestsPerConversation: number;
  private createdAt: number;
  private lastActivity: number;

  constructor(sessionId: string, maxRequestsPerConversation: number = 50) {
    this.sessionId = sessionId;
    this.maxRequestsPerConversation = maxRequestsPerConversation;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  async enqueueRequest(conversationId: string, request: QueuedRequest): Promise<void> {
    let conversationQueue = this.conversationQueues.get(conversationId);
    if (!conversationQueue) {
      conversationQueue = new ConversationQueue(conversationId, this.maxRequestsPerConversation);
      this.conversationQueues.set(conversationId, conversationQueue);
    }

    await conversationQueue.enqueueRequest(request);
    this.lastActivity = Date.now();
  }

  async dequeueRequest(conversationId: string): Promise<QueuedRequest | null> {
    const conversationQueue = this.conversationQueues.get(conversationId);
    if (!conversationQueue) {
      return null;
    }

    const request = await conversationQueue.dequeueRequest();
    if (request) {
      this.lastActivity = Date.now();
    }

    return request;
  }

  getConversationsWithRequests(): string[] {
    return Array.from(this.conversationQueues.entries())
      .filter(([_, queue]) => queue.hasQueuedRequests())
      .map(([conversationId, _]) => conversationId);
  }

  getConversationQueue(conversationId: string): ConversationQueue | undefined {
    return this.conversationQueues.get(conversationId);
  }

  removeRequest(conversationId: string, requestId: string): boolean {
    const conversationQueue = this.conversationQueues.get(conversationId);
    if (!conversationQueue) {
      return false;
    }

    return conversationQueue.removeRequest(requestId);
  }

  getStatus(): QueueStatus {
    const conversations = Array.from(this.conversationQueues.entries()).map(([id, queue]) => ({
      conversationId: id,
      queuedCount: queue.getQueuedCount(),
      processingCount: queue.getProcessingCount(),
      lastActivity: queue.getLastActivity()
    }));

    return {
      sessionId: this.sessionId,
      exists: true,
      totalQueued: conversations.reduce((sum, conv) => sum + conv.queuedCount, 0),
      totalProcessing: conversations.reduce((sum, conv) => sum + conv.processingCount, 0),
      conversations,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity
    };
  }
}

class ConversationQueue {
  private conversationId: string;
  public queuedRequests: QueuedRequest[] = [];
  public processingCount: number = 0;
  public lastActivity: number;
  private maxRequests: number;

  constructor(conversationId: string, maxRequests: number) {
    this.conversationId = conversationId;
    this.maxRequests = maxRequests;
    this.lastActivity = Date.now();
  }

  async enqueueRequest(request: QueuedRequest): Promise<void> {
    if (this.queuedRequests.length >= this.maxRequests) {
      throw new Error(`Conversation ${this.conversationId} has reached maximum queue size`);
    }

    // 按优先级插入队列
    const insertIndex = this.findInsertPosition(request.priority);
    this.queuedRequests.splice(insertIndex, 0, request);
    this.lastActivity = Date.now();
  }

  async dequeueRequest(): Promise<QueuedRequest | null> {
    const request = this.queuedRequests.shift();
    if (request) {
      this.processingCount++;
      this.lastActivity = Date.now();
    }
    return request || null;
  }

  hasQueuedRequests(): boolean {
    return this.queuedRequests.length > 0;
  }

  removeRequest(requestId: string): boolean {
    const index = this.queuedRequests.findIndex(req => req.requestId === requestId);
    if (index !== -1) {
      this.queuedRequests.splice(index, 1);
      this.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  getQueuedCount(): number {
    return this.queuedRequests.length;
  }

  getProcessingCount(): number {
    return this.processingCount;
  }

  getLastActivity(): number {
    return this.lastActivity;
  }

  private findInsertPosition(priority: number): number {
    // 高优先级数字越大，排在前面
    for (let i = 0; i < this.queuedRequests.length; i++) {
      if (this.queuedRequests[i].priority < priority) {
        return i;
      }
    }
    return this.queuedRequests.length;
  }
}
```

### 流控相关类型定义
```typescript
// src/router/types/session-types.ts
export interface QueuedRequest {
  requestId: string;
  sessionId: string;
  conversationId: string;
  request: RCCRequest;
  enqueuedAt: number;
  enqueuedAtReadable: string;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export interface ProcessingRequest extends QueuedRequest {
  startedAt: number;
  startedAtReadable: string;
}

export interface QueueStatus {
  sessionId: string;
  conversationId?: string;
  exists: boolean;
  totalQueued: number;
  totalProcessing: number;
  conversations: ConversationStatus[];
  createdAt?: number;
  lastActivity?: number;
}

export interface ConversationStatus {
  conversationId: string;
  queuedCount: number;
  processingCount: number;
  lastActivity: number;
}

export interface FlowControlConfig {
  maxConcurrentSessions: number;
  maxRequestsPerConversation: number;
  requestTimeout: number;
  sessionCleanupInterval: number;
  priorityWeights: Record<string, number>;
}
```

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup响应
- ✅ 无重复代码
- ✅ 无硬编码路由规则
- ✅ 完整的数据校验
- ✅ 标准接口通信
- ✅ 会话级别的请求顺序保证
- ✅ 对话内请求的串行处理
- ✅ 并发控制和资源管理