import { ConversationQueue, RequestProcessor, QueueStatus, FlowControlConfig, ProcessingStatus } from './types';

export class ConversationQueueImpl implements ConversationQueue {
  public readonly conversationId: string;
  public readonly sessionId: string;
  public readonly requests: RequestProcessor[];
  public isProcessing: boolean;
  public readonly createdAt: Date;
  public lastActivity: Date;

  private config: FlowControlConfig;
  private processingPromise?: Promise<void>;

  constructor(conversationId: string, sessionId: string, config: FlowControlConfig) {
    this.conversationId = conversationId;
    this.sessionId = sessionId;
    this.requests = [];
    this.isProcessing = false;
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.config = config;
  }

  async enqueue(request: RequestProcessor): Promise<void> {
    // 检查队列长度限制
    if (this.requests.length >= this.config.maxRequestsPerConversation) {
      throw new Error(`Conversation queue full: ${this.config.maxRequestsPerConversation} requests`);
    }

    // 添加请求到队列
    this.requests.push(request);
    this.lastActivity = new Date();

    console.log(
      `[${this.sessionId}/${this.conversationId}] Enqueued request ${request.requestId}, queue length: ${this.requests.length}`
    );

    // 如果当前没有在处理，立即开始处理
    if (!this.isProcessing && this.requests.length > 0) {
      await this.processNext();
    }
  }

  async processNext(): Promise<void> {
    // 防止并发处理
    if (this.isProcessing || this.requests.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.lastActivity = new Date();

    try {
      // 按优先级排序请求队列
      this.sortRequestsByPriority();

      // 处理队列中的第一个请求
      const processor = this.requests.shift();
      if (!processor) {
        return;
      }

      console.log(`[${this.sessionId}/${this.conversationId}] Processing request ${processor.requestId}`);

      // 启动处理（异步）
      this.processingPromise = this.processRequest(processor);
      await this.processingPromise;

      console.log(`[${this.sessionId}/${this.conversationId}] Completed request ${processor.requestId}`);
    } catch (error) {
      console.error(`[${this.sessionId}/${this.conversationId}] Processing error:`, error);
    } finally {
      this.isProcessing = false;
      this.processingPromise = undefined;

      // 继续处理下一个请求
      if (this.requests.length > 0) {
        // 异步处理下一个，避免阻塞
        setImmediate(() => this.processNext());
      }
    }
  }

  private async processRequest(processor: RequestProcessor): Promise<void> {
    try {
      // 设置开始处理时间
      processor.startedAt = new Date();
      processor.status = 'processing';

      // 执行实际处理，不使用mockup
      await processor.process();

      // 设置完成时间
      processor.completedAt = new Date();
      processor.status = 'completed';
    } catch (error) {
      processor.status = 'failed';
      processor.error = {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        retryable: this.isRetryableError(error),
        context: { conversationId: this.conversationId, sessionId: this.sessionId },
      };

      console.error(`Request ${processor.requestId} failed:`, error);

      // 如果错误可重试，考虑重新排队
      if (processor.error.retryable && this.shouldRetry(processor)) {
        await this.retryRequest(processor);
      }

      throw error;
    }
  }

  private sortRequestsByPriority(): void {
    // 根据优先级权重排序
    this.requests.sort((a, b) => {
      const weights = this.config.priorityWeights;
      const aWeight = this.getPriorityWeight(a, weights);
      const bWeight = this.getPriorityWeight(b, weights);

      // 高权重优先
      if (aWeight !== bWeight) {
        return bWeight - aWeight;
      }

      // 相同优先级按时间排序（FIFO）
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private getPriorityWeight(processor: RequestProcessor, weights: any): number {
    // 从request中获取优先级信息
    const priority = processor.request.headers?.['x-priority'] || 'medium';
    return weights[priority] || weights.medium;
  }

  private isRetryableError(error: any): boolean {
    // 判断错误是否可重试
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // 网络错误通常可重试
      if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
        return true;
      }

      // 临时服务器错误可重试
      if (message.includes('503') || message.includes('502') || message.includes('504')) {
        return true;
      }

      // 认证错误和客户端错误通常不可重试
      if (message.includes('401') || message.includes('403') || message.includes('400')) {
        return false;
      }
    }

    // 默认可重试
    return true;
  }

  private shouldRetry(processor: RequestProcessor): boolean {
    const metrics = processor.getMetrics();
    const maxRetries = 3; // 最大重试次数

    return metrics.retryCount < maxRetries;
  }

  private async retryRequest(processor: RequestProcessor): Promise<void> {
    const metrics = processor.getMetrics();
    const retryDelay = Math.min(1000 * Math.pow(2, metrics.retryCount), 30000); // 指数退避，最大30秒

    console.log(`Retrying request ${processor.requestId} after ${retryDelay}ms (attempt ${metrics.retryCount + 1})`);

    // 延迟后重新排队
    setTimeout(() => {
      processor.status = 'pending';
      processor.error = undefined;
      this.requests.unshift(processor); // 添加到队列前端，优先处理重试
    }, retryDelay);
  }

  getCurrentStatus(): QueueStatus {
    const currentRequest = this.isProcessing && this.requests.length > 0 ? this.requests[0] : undefined;

    // 计算预估等待时间
    const estimatedWaitTime = this.calculateEstimatedWaitTime();
    const estimatedProcessingTime = this.calculateEstimatedProcessingTime();

    return {
      conversationId: this.conversationId,
      queueLength: this.requests.length,
      isProcessing: this.isProcessing,
      currentRequest: currentRequest?.requestId,
      waitTime: estimatedWaitTime,
      estimatedProcessingTime: estimatedProcessingTime,
    };
  }

  private calculateEstimatedWaitTime(): number {
    if (!this.isProcessing || this.requests.length === 0) {
      return 0;
    }

    // 基于历史处理时间估算
    const averageProcessingTime = this.getAverageProcessingTime();
    return averageProcessingTime * this.requests.length;
  }

  private calculateEstimatedProcessingTime(): number {
    return this.getAverageProcessingTime();
  }

  private getAverageProcessingTime(): number {
    // 从已完成的请求中计算平均处理时间
    const completedRequests = this.requests.filter(req => req.status === 'completed');

    if (completedRequests.length === 0) {
      return 5000; // 默认5秒
    }

    const totalTime = completedRequests.reduce((total, req) => {
      const metrics = req.getMetrics();
      return total + (metrics.processingTime || 0);
    }, 0);

    return totalTime / completedRequests.length;
  }

  getQueueLength(): number {
    return this.requests.length;
  }

  clear(): void {
    console.log(`[${this.sessionId}/${this.conversationId}] Clearing queue with ${this.requests.length} requests`);

    // 中止所有待处理的请求
    for (const request of this.requests) {
      if (request.status === 'pending' || request.status === 'processing') {
        request.status = 'aborted';
      }
    }

    this.requests.length = 0;
    this.isProcessing = false;
    this.processingPromise = undefined;
  }

  // 获取队列统计信息
  getStatistics(): any {
    const statusCounts = this.requests.reduce(
      (counts, req) => {
        counts[req.status] = (counts[req.status] || 0) + 1;
        return counts;
      },
      {} as Record<ProcessingStatus, number>
    );

    return {
      conversationId: this.conversationId,
      sessionId: this.sessionId,
      totalRequests: this.requests.length,
      isProcessing: this.isProcessing,
      statusCounts,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      averageProcessingTime: this.getAverageProcessingTime(),
    };
  }
}
