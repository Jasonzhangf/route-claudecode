// 测试夹具数据
export const testFixtures = {
  // 用户相关夹具
  users: {
    admin: {
      id: 'user-admin-1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      createdAt: new Date('2023-01-01T00:00:00Z')
    },
    
    regular: {
      id: 'user-regular-1',
      name: 'Regular User',
      email: 'user@example.com',
      role: 'user',
      createdAt: new Date('2023-01-02T00:00:00Z')
    },
    
    premium: {
      id: 'user-premium-1',
      name: 'Premium User',
      email: 'premium@example.com',
      role: 'premium',
      createdAt: new Date('2023-01-03T00:00:00Z')
    }
  },
  
  // API 请求夹具
  apiRequests: {
    simpleGet: {
      method: 'GET',
      url: '/api/status',
      headers: {
        'Content-Type': 'application/json'
      },
      timestamp: new Date('2023-01-01T00:00:00Z')
    },
    
    postWithBody: {
      method: 'POST',
      url: '/api/users',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        name: 'Test User',
        email: 'test@example.com'
      },
      timestamp: new Date('2023-01-01T00:00:00Z')
    }
  },
  
  // 流水线配置夹具
  pipelineConfigs: {
    basic: {
      id: 'pipeline-basic-1',
      name: 'Basic Pipeline',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      enabled: true,
      priority: 1
    },
    
    advanced: {
      id: 'pipeline-advanced-1',
      name: 'Advanced Pipeline',
      provider: 'anthropic',
      model: 'claude-2',
      enabled: true,
      priority: 2,
      config: {
        temperature: 0.7,
        maxTokens: 2000
      }
    }
  }
};