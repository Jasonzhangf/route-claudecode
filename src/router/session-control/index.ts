// Session Control Module - RCC v4.0 会话流控制系统
// 实现三层会话管理：session.conversationID.requestID

export * from './types';
export { FlowControlManager } from './flow-control-manager';
export { ConversationQueueImpl } from './conversation-queue';
export { RequestProcessorImpl } from './request-processor';

// 默认配置
export const DEFAULT_FLOW_CONTROL_CONFIG = {
  maxSessionsPerClient: 100,
  maxConversationsPerSession: 50,
  maxRequestsPerConversation: 20,
  sessionTimeout: 30 * 60 * 1000, // 30分钟
  conversationTimeout: 10 * 60 * 1000, // 10分钟
  requestTimeout: 60 * 1000, // 60秒
  priorityWeights: {
    high: 100,
    medium: 50,
    low: 10,
  },
  cleanupInterval: 5 * 60 * 1000, // 5分钟清理一次
};
