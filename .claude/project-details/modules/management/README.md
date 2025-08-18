# 管理模块 (Management Module)

## 模块概述

管理模块是RCC v4.0系统的运营管理中枢，提供Web管理界面、CLI管理命令、系统监控、配置管理和健康检查等功能。

## 模块职责

1. **Web管理界面**: 提供基于Web的图形化管理界面
2. **CLI管理命令**: 提供命令行管理接口
3. **系统监控**: 实时监控系统状态和性能指标
4. **配置管理**: 管理系统配置的查看、编辑和更新
5. **健康检查**: 监控各组件和服务的健康状态
6. **日志管理**: 管理和查看系统日志
7. **用户管理**: 管理管理员用户和权限

## 模块结构

```
management/
├── README.md                          # 本模块设计文档
├── index.ts                           # 模块入口和导出
├── management-server.ts                # 管理服务器
├── web-ui/                            # Web管理界面
│   ├── public/                         # 静态资源
│   │   ├── index.html                  # 主页
│   │   ├── css/                        # 样式文件
│   │   ├── js/                         # JavaScript文件
│   │   └── assets/                     # 图片和其他资源
│   ├── src/                            # 前端源代码
│   │   ├── components/                  # Vue组件
│   │   ├── views/                      # 页面视图
│   │   ├── store/                       # 状态管理
│   │   └── router/                      # 路由配置
│   ├── package.json                    # 前端依赖
│   └── vite.config.ts                 # 构建配置
├── cli/                               # CLI管理命令
│   ├── management-cli.ts               # 管理CLI入口
│   ├── config-commands.ts             # 配置命令
│   ├── monitor-commands.ts             # 监控命令
│   ├── log-commands.ts                 # 日志命令
│   └── health-commands.ts              # 健康检查命令
├── api/                               # 管理API
│   ├── config-api.ts                   # 配置API
│   ├── monitor-api.ts                  # 监控API
│   ├── log-api.ts                      # 日志API
│   └── health-api.ts                   # 健康检查API
├── dashboard/                         # 仪表板
│   ├── system-dashboard.ts             # 系统仪表板
│   ├── performance-dashboard.ts        # 性能仪表板
│   └── usage-dashboard.ts              # 使用情况仪表板
├── config-manager/                    # 配置管理器
│   ├── config-viewer.ts               # 配置查看器
│   ├── config-editor.ts                # 配置编辑器
│   └── config-validator.ts             # 配置验证器
├── monitor/                           # 监控系统
│   ├── system-monitor.ts               # 系统监控器
│   ├── performance-monitor.ts          # 性能监控器
│   ├── resource-monitor.ts             # 资源监控器
│   └── alert-manager.ts                # 告警管理器
├── health-checker/                    # 健康检查器
│   ├── component-health.ts             # 组件健康检查
│   ├── service-health.ts                # 服务健康检查
│   ├── connectivity-health.ts          # 连接性健康检查
│   └── performance-health.ts            # 性能健康检查
├── log-manager/                       # 日志管理器
│   ├── log-viewer.ts                   # 日志查看器
│   ├── log-searcher.ts                 # 日志搜索器
│   ├── log-exporter.ts                # 日志导出器
│   └── log-analyzer.ts                 # 日志分析器
└── auth/                              # 认证授权
    ├── user-manager.ts                 # 用户管理器
    ├── auth-manager.ts                 # 认证管理器
    ├── permission-manager.ts            # 权限管理器
    └── session-manager.ts              # 会话管理器
```

## 核心组件

### 管理服务器 (ManagementServer)
负责管理Web界面和API的HTTP服务器，是模块的主入口点。

### Web管理界面 (WebUI)
提供基于Vue.js的现代化Web管理界面。

### CLI管理命令 (ManagementCLI)
提供命令行管理接口。

### API管理器 (APIManager)
提供RESTful管理API。

### 仪表板系统 (DashboardSystem)
提供实时的系统状态和性能仪表板。

### 配置管理器 (ConfigManager)
管理系统的配置查看、编辑和验证。

### 监控系统 (MonitorSystem)
实时监控系统各项指标。

### 健康检查器 (HealthChecker)
检查各组件和服务的健康状态。

### 日志管理器 (LogManager)
管理系统的日志记录和查看。

### 认证授权系统 (AuthSystem)
管理用户认证和权限控制。

## Web管理界面

### 仪表板页面
```vue
<!-- Dashboard.vue -->
<template>
  <div class="dashboard">
    <h1>系统仪表板</h1>
    
    <!-- 系统状态概览 -->
    <div class="status-overview">
      <div class="status-card" :class="{ healthy: systemStatus.healthy }">
        <h3>系统状态</h3>
        <p>{{ systemStatus.healthy ? '正常运行' : '存在问题' }}</p>
        <span class="uptime">{{ systemStatus.uptime }}</span>
      </div>
      
      <div class="status-card">
        <h3>活跃请求</h3>
        <p>{{ activeRequests }}</p>
        <span class="trend">{{ requestTrend }}</span>
      </div>
      
      <div class="status-card">
        <h3>CPU使用率</h3>
        <p>{{ cpuUsage }}%</p>
        <ProgressBar :value="cpuUsage" />
      </div>
      
      <div class="status-card">
        <h3>内存使用率</h3>
        <p>{{ memoryUsage }}%</p>
        <ProgressBar :value="memoryUsage" />
      </div>
    </div>
    
    <!-- 性能图表 -->
    <div class="performance-charts">
      <LineChart 
        title="请求处理时间趋势" 
        :data="requestProcessingTimes" 
        :options="chartOptions" 
      />
      
      <BarChart 
        title="各模块请求分布" 
        :data="moduleRequestDistribution" 
        :options="barChartOptions" 
      />
    </div>
    
    <!-- 告警列表 -->
    <div class="alerts-section">
      <h2>最近告警</h2>
      <AlertList :alerts="recentAlerts" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '@/store/system';
import LineChart from '@/components/charts/LineChart.vue';
import BarChart from '@/components/charts/BarChart.vue';
import ProgressBar from '@/components/ui/ProgressBar.vue';
import AlertList from '@/components/alerts/AlertList.vue';

const systemStore = useSystemStore();
const systemStatus = ref({});
const activeRequests = ref(0);
const cpuUsage = ref(0);
const memoryUsage = ref(0);
const requestProcessingTimes = ref([]);
const moduleRequestDistribution = ref([]);
const recentAlerts = ref([]);

onMounted(async () => {
  // 获取系统状态
  systemStatus.value = await systemStore.getSystemStatus();
  
  // 获取活跃请求数
  activeRequests.value = await systemStore.getActiveRequests();
  
  // 获取资源使用率
  const resources = await systemStore.getResourceUsage();
  cpuUsage.value = resources.cpu;
  memoryUsage.value = resources.memory;
  
  // 获取性能数据
  requestProcessingTimes.value = await systemStore.getRequestProcessingTimes();
  moduleRequestDistribution.value = await systemStore.getModuleRequestDistribution();
  
  // 获取告警列表
  recentAlerts.value = await systemStore.getRecentAlerts();
});
</script>
```

### 配置管理页面
```vue
<!-- ConfigManager.vue -->
<template>
  <div class="config-manager">
    <h1>配置管理</h1>
    
    <!-- 配置导航 -->
    <nav class="config-nav">
      <ul>
        <li 
          v-for="category in configCategories" 
          :key="category.id"
          :class="{ active: activeCategory === category.id }"
          @click="setActiveCategory(category.id)"
        >
          {{ category.name }}
        </li>
      </ul>
    </nav>
    
    <!-- 配置编辑器 -->
    <div class="config-editor">
      <div class="editor-header">
        <h2>{{ activeCategoryName }}</h2>
        <div class="actions">
          <button @click="saveConfig" class="btn-primary">保存配置</button>
          <button @click="resetConfig" class="btn-secondary">重置</button>
          <button @click="validateConfig" class="btn-info">验证</button>
        </div>
      </div>
      
      <form class="config-form">
        <div 
          v-for="field in activeConfigFields" 
          :key="field.name"
          class="form-field"
        >
          <label :for="field.name">{{ field.label }}</label>
          
          <!-- 文本输入 -->
          <input 
            v-if="field.type === 'text'"
            :id="field.name"
            v-model="configData[field.name]"
            :type="field.inputType || 'text'"
            :placeholder="field.placeholder"
          />
          
          <!-- 数字输入 -->
          <input 
            v-else-if="field.type === 'number'"
            :id="field.name"
            v-model.number="configData[field.name]"
            type="number"
            :min="field.min"
            :max="field.max"
            :step="field.step"
          />
          
          <!-- 布尔值开关 -->
          <ToggleSwitch 
            v-else-if="field.type === 'boolean'"
            :id="field.name"
            v-model="configData[field.name]"
            :label="field.label"
          />
          
          <!-- 下拉选择 -->
          <select 
            v-else-if="field.type === 'select'"
            :id="field.name"
            v-model="configData[field.name]"
          >
            <option 
              v-for="option in field.options" 
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          
          <!-- 多行文本 -->
          <textarea 
            v-else-if="field.type === 'textarea'"
            :id="field.name"
            v-model="configData[field.name]"
            :rows="field.rows || 5"
            :placeholder="field.placeholder"
          ></textarea>
          
          <span v-if="field.description" class="field-description">
            {{ field.description }}
          </span>
        </div>
      </form>
      
      <!-- 验证结果 -->
      <div v-if="validationResult" class="validation-result" :class="validationResult.type">
        <h3>{{ validationResult.title }}</h3>
        <ul>
          <li v-for="message in validationResult.messages" :key="message">
            {{ message }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue';

const activeCategory = ref('providers');
const configData = ref({});
const validationResult = ref(null);

const configCategories = [
  { id: 'providers', name: 'Provider配置' },
  { id: 'routing', name: '路由配置' },
  { id: 'server', name: '服务器配置' },
  { id: 'debug', name: '调试配置' },
  { id: 'security', name: '安全配置' }
];

const activeCategoryName = computed(() => {
  const category = configCategories.find(c => c.id === activeCategory.value);
  return category ? category.name : '';
});

const activeConfigFields = computed(() => {
  // 根据当前激活的分类返回相应的配置字段
  return getConfigFieldsForCategory(activeCategory.value);
});

function setActiveCategory(categoryId: string) {
  activeCategory.value = categoryId;
  loadConfigForCategory(categoryId);
}

async function loadConfigForCategory(categoryId: string) {
  try {
    const config = await configApi.getConfig(categoryId);
    configData.value = config;
  } catch (error) {
    console.error(`Failed to load config for category ${categoryId}:`, error);
  }
}

async function saveConfig() {
  try {
    await configApi.saveConfig(activeCategory.value, configData.value);
    showNotification('success', '配置保存成功');
  } catch (error) {
    showNotification('error', `配置保存失败: ${error.message}`);
  }
}

async function validateConfig() {
  try {
    const result = await configApi.validateConfig(activeCategory.value, configData.value);
    validationResult.value = result;
  } catch (error) {
    validationResult.value = {
      type: 'error',
      title: '验证失败',
      messages: [error.message]
    };
  }
}

function resetConfig() {
  loadConfigForCategory(activeCategory.value);
  validationResult.value = null;
}
</script>
```

## CLI管理命令

### 配置管理命令
```typescript
// config-commands.ts
import { Command } from 'commander';
import { ConfigManager } from '../config-manager';

export class ConfigCommands {
  private configManager: ConfigManager;
  
  constructor() {
    this.configManager = new ConfigManager();
  }
  
  registerCommands(program: Command): void {
    program
      .command('config:list')
      .description('列出所有配置项')
      .option('-c, --category <category>', '指定配置分类')
      .action(async (options) => {
        try {
          const configs = await this.configManager.listConfigs(options.category);
          this.printConfigs(configs);
        } catch (error) {
          console.error('❌ 配置列表获取失败:', error.message);
        }
      });
      
    program
      .command('config:get <key>')
      .description('获取指定配置项的值')
      .option('-f, --format <format>', '输出格式 (json|table|raw)', 'table')
      .action(async (key, options) => {
        try {
          const value = await this.configManager.getConfig(key);
          this.printConfigValue(key, value, options.format);
        } catch (error) {
          console.error(`❌ 获取配置项 ${key} 失败:`, error.message);
        }
      });
      
    program
      .command('config:set <key> <value>')
      .description('设置配置项的值')
      .option('-t, --type <type>', '值类型 (string|number|boolean)', 'string')
      .action(async (key, value, options) => {
        try {
          const typedValue = this.convertValueType(value, options.type);
          await this.configManager.setConfig(key, typedValue);
          console.log(`✅ 配置项 ${key} 设置成功`);
        } catch (error) {
          console.error(`❌ 设置配置项 ${key} 失败:`, error.message);
        }
      });
      
    program
      .command('config:validate')
      .description('验证配置文件的有效性')
      .option('-f, --file <file>', '指定配置文件路径')
      .action(async (options) => {
        try {
          const result = await this.configManager.validateConfig(options.file);
          if (result.valid) {
            console.log('✅ 配置文件验证通过');
          } else {
            console.log('❌ 配置文件验证失败:');
            result.errors.forEach(error => {
              console.log(`  - ${error}`);
            });
          }
        } catch (error) {
          console.error('❌ 配置验证失败:', error.message);
        }
      });
  }
  
  private convertValueType(value: string, type: string): any {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      default:
        return value;
    }
  }
  
  private printConfigs(configs: Record<string, any>): void {
    console.table(configs);
  }
  
  private printConfigValue(key: string, value: any, format: string): void {
    switch (format) {
      case 'json':
        console.log(JSON.stringify(value, null, 2));
        break;
      case 'raw':
        console.log(value);
        break;
      default:
        console.log(`${key}: ${value}`);
    }
  }
}
```

### 监控命令
```typescript
// monitor-commands.ts
import { Command } from 'commander';
import { MonitorSystem } from '../monitor';

export class MonitorCommands {
  private monitor: MonitorSystem;
  
  constructor() {
    this.monitor = new MonitorSystem();
  }
  
  registerCommands(program: Command): void {
    program
      .command('monitor:status')
      .description('查看系统监控状态')
      .option('-d, --detailed', '显示详细信息')
      .option('-j, --json', '以JSON格式输出')
      .action(async (options) => {
        try {
          const status = await this.monitor.getSystemStatus();
          
          if (options.json) {
            console.log(JSON.stringify(status, null, 2));
          } else {
            this.printSystemStatus(status, options.detailed);
          }
        } catch (error) {
          console.error('❌ 获取系统状态失败:', error.message);
        }
      });
      
    program
      .command('monitor:resources')
      .description('查看系统资源使用情况')
      .option('-w, --watch', '持续监控模式')
      .option('-i, --interval <seconds>', '监控间隔(秒)', '5')
      .action(async (options) => {
        try {
          if (options.watch) {
            await this.watchResources(Number(options.interval));
          } else {
            const resources = await this.monitor.getResources();
            this.printResourceUsage(resources);
          }
        } catch (error) {
          console.error('❌ 获取资源使用情况失败:', error.message);
        }
      });
      
    program
      .command('monitor:performance')
      .description('查看系统性能指标')
      .option('-t, --top <count>', '显示Top N性能指标', '10')
      .option('-s, --sort <metric>', '排序依据 (latency|throughput|errors)', 'latency')
      .action(async (options) => {
        try {
          const performance = await this.monitor.getPerformanceMetrics({
            top: Number(options.top),
            sortBy: options.sort
          });
          this.printPerformanceMetrics(performance);
        } catch (error) {
          console.error('❌ 获取性能指标失败:', error.message);
        }
      });
      
    program
      .command('monitor:alerts')
      .description('查看系统告警')
      .option('-a, --active', '只显示活跃告警')
      .option('-l, --level <level>', '告警级别 (critical|warning|info)', 'warning')
      .action(async (options) => {
        try {
          const alerts = await this.monitor.getAlerts({
            activeOnly: options.active,
            minLevel: options.level
          });
          this.printAlerts(alerts);
        } catch (error) {
          console.error('❌ 获取告警信息失败:', error.message);
        }
      });
  }
  
  private async watchResources(interval: number): Promise<void> {
    console.log(`🔍 开始监控系统资源使用情况 (间隔: ${interval}秒)`);
    console.log('按 Ctrl+C 停止监控\n');
    
    // 清屏函数
    const clearScreen = () => {
      process.stdout.write('\x1Bc');
    };
    
    const updateDisplay = async () => {
      try {
        const resources = await this.monitor.getResources();
        clearScreen();
        console.log(`${new Date().toISOString()} - 系统资源使用情况:`);
        this.printResourceUsage(resources, true);
      } catch (error) {
        console.error('监控更新失败:', error.message);
      }
    };
    
    // 初始显示
    await updateDisplay();
    
    // 定期更新
    const timer = setInterval(updateDisplay, interval * 1000);
    
    // 处理退出信号
    process.on('SIGINT', () => {
      clearInterval(timer);
      console.log('\n🛑 监控已停止');
      process.exit(0);
    });
  }
  
  private printSystemStatus(status: SystemStatus, detailed: boolean): void {
    console.log('📊 系统监控状态:');
    console.log(`   状态: ${status.healthy ? '🟢 正常' : '🔴 异常'}`);
    console.log(`   启动时间: ${new Date(status.startTime).toLocaleString()}`);
    console.log(`   运行时长: ${this.formatDuration(status.uptime)}`);
    
    if (detailed) {
      console.log(`   活跃请求: ${status.activeRequests}`);
      console.log(`   总请求数: ${status.totalRequests}`);
      console.log(`   成功率: ${(status.successRate * 100).toFixed(2)}%`);
    }
  }
  
  private printResourceUsage(resources: ResourceUsage, compact: boolean = false): void {
    if (compact) {
      console.log(`CPU: ${resources.cpu.toFixed(1)}% | 内存: ${resources.memory.toFixed(1)}% | 磁盘: ${resources.disk.toFixed(1)}%`);
    } else {
      console.log('🖥️  资源使用情况:');
      console.log(`   CPU使用率: ${resources.cpu.toFixed(2)}%`);
      console.log(`   内存使用率: ${resources.memory.toFixed(2)}%`);
      console.log(`   磁盘使用率: ${resources.disk.toFixed(2)}%`);
      console.log(`   网络流量: ↑${this.formatBytes(resources.network.outbound)}/s ↓${this.formatBytes(resources.network.inbound)}/s`);
    }
  }
  
  private printPerformanceMetrics(metrics: PerformanceMetrics): void {
    console.log('⚡ 性能指标:');
    console.log(`   平均响应时间: ${metrics.avgLatency.toFixed(2)}ms`);
    console.log(`   吞吐量: ${metrics.throughput.toFixed(2)} req/s`);
    console.log(`   错误率: ${(metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`   并发连接数: ${metrics.concurrentConnections}`);
  }
  
  private printAlerts(alerts: Alert[]): void {
    console.log(`🔔 系统告警 (${alerts.length}条):`);
    alerts.forEach(alert => {
      const levelIcon = {
        critical: '🔴',
        warning: '🟡',
        info: '🔵'
      }[alert.level];
      
      console.log(`   ${levelIcon} [${alert.level.toUpperCase()}] ${alert.message}`);
      console.log(`      时间: ${new Date(alert.timestamp).toLocaleString()}`);
      console.log(`      组件: ${alert.component}`);
      if (alert.resolution) {
        console.log(`      解决方案: ${alert.resolution}`);
      }
      console.log('');
    });
  }
  
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}天${hours % 24}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
  
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}
```

## 管理API

### 配置管理API
```typescript
// config-api.ts
import { FastifyInstance } from 'fastify';
import { ConfigManager } from '../config-manager';

export class ConfigAPI {
  private configManager: ConfigManager;
  
  constructor(private server: FastifyInstance) {
    this.configManager = new ConfigManager();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // 获取所有配置
    this.server.get('/api/config', async (request, reply) => {
      try {
        const configs = await this.configManager.getAllConfigs();
        return { success: true, data: configs };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error.message
        });
      }
    });
    
    // 获取指定配置项
    this.server.get('/api/config/:key', async (request, reply) => {
      const { key } = request.params as { key: string };
      
      try {
        const value = await this.configManager.getConfig(key);
        return { success: true, data: { [key]: value } };
      } catch (error) {
        return reply.status(404).send({
          success: false,
          error: `Configuration key '${key}' not found`
        });
      }
    });
    
    // 更新配置项
    this.server.put('/api/config/:key', async (request, reply) => {
      const { key } = request.params as { key: string };
      const { value } = request.body as { value: any };
      
      try {
        await this.configManager.setConfig(key, value);
        return { success: true, message: `Configuration key '${key}' updated successfully` };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to update configuration key '${key}': ${error.message}`
        });
      }
    });
    
    // 批量更新配置
    this.server.post('/api/config/batch', async (request, reply) => {
      const updates = request.body as Record<string, any>;
      
      try {
        await this.configManager.batchUpdate(updates);
        return { success: true, message: 'Configuration updated successfully' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to update configuration: ${error.message}`
        });
      }
    });
    
    // 验证配置
    this.server.post('/api/config/validate', async (request, reply) => {
      const { config } = request.body as { config?: any };
      
      try {
        const result = await this.configManager.validateConfig(config);
        return { success: true, data: result };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Configuration validation failed: ${error.message}`
        });
      }
    });
    
    // 重载配置
    this.server.post('/api/config/reload', async (request, reply) => {
      try {
        await this.configManager.reloadConfig();
        return { success: true, message: 'Configuration reloaded successfully' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to reload configuration: ${error.message}`
        });
      }
    });
  }
}
```

### 监控API
```typescript
// monitor-api.ts
import { FastifyInstance } from 'fastify';
import { MonitorSystem } from '../monitor';

export class MonitorAPI {
  private monitor: MonitorSystem;
  
  constructor(private server: FastifyInstance) {
    this.monitor = new MonitorSystem();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // 获取系统状态
    this.server.get('/api/monitor/status', async (request, reply) => {
      try {
        const status = await this.monitor.getSystemStatus();
        return { success: true, data: status };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to get system status: ${error.message}`
        });
      }
    });
    
    // 获取资源使用情况
    this.server.get('/api/monitor/resources', async (request, reply) => {
      try {
        const resources = await this.monitor.getResources();
        return { success: true, data: resources };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to get resource usage: ${error.message}`
        });
      }
    });
    
    // 获取性能指标
    this.server.get('/api/monitor/performance', async (request, reply) => {
      const { top, sortBy } = request.query as { top?: string; sortBy?: string };
      
      try {
        const metrics = await this.monitor.getPerformanceMetrics({
          top: top ? Number(top) : undefined,
          sortBy: sortBy as 'latency' | 'throughput' | 'errors'
        });
        return { success: true, data: metrics };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to get performance metrics: ${error.message}`
        });
      }
    });
    
    // 获取告警信息
    this.server.get('/api/monitor/alerts', async (request, reply) => {
      const { activeOnly, minLevel } = request.query as { 
        activeOnly?: string; 
        minLevel?: string 
      };
      
      try {
        const alerts = await this.monitor.getAlerts({
          activeOnly: activeOnly === 'true',
          minLevel: minLevel as 'critical' | 'warning' | 'info'
        });
        return { success: true, data: alerts };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to get alerts: ${error.message}`
        });
      }
    });
    
    // 获取实时数据流
    this.server.get('/api/monitor/stream', { websocket: true }, async (connection, request) => {
      const sendUpdate = async () => {
        try {
          const data = {
            timestamp: Date.now(),
            status: await this.monitor.getSystemStatus(),
            resources: await this.monitor.getResources(),
            performance: await this.monitor.getPerformanceMetrics()
          };
          
          connection.socket.send(JSON.stringify(data));
        } catch (error) {
          console.error('WebSocket update failed:', error.message);
        }
      };
      
      // 发送初始数据
      await sendUpdate();
      
      // 定期发送更新
      const interval = setInterval(sendUpdate, 5000);
      
      // 处理连接关闭
      connection.socket.on('close', () => {
        clearInterval(interval);
      });
    });
  }
}
```

## 健康检查系统

### 组件健康检查
```typescript
// component-health.ts
export interface ComponentHealth {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  details: Record<string, any>;
  lastError?: string;
}

export class ComponentHealthChecker {
  private healthChecks: Map<string, () => Promise<ComponentHealth>> = new Map();
  
  registerHealthCheck(component: string, checkFn: () => Promise<ComponentHealth>): void {
    this.healthChecks.set(component, checkFn);
  }
  
  async checkComponent(component: string): Promise<ComponentHealth> {
    const checkFn = this.healthChecks.get(component);
    if (!checkFn) {
      return {
        component,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: 0,
        details: { error: 'Health check not registered' }
      };
    }
    
    const startTime = Date.now();
    try {
      const result = await checkFn();
      return {
        ...result,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        component,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        details: {},
        lastError: error.message
      };
    }
  }
  
  async checkAllComponents(): Promise<ComponentHealth[]> {
    const checks = Array.from(this.healthChecks.keys()).map(component => 
      this.checkComponent(component)
    );
    
    return Promise.all(checks);
  }
}

// 客户端健康检查
export const clientHealthCheck = async (): Promise<ComponentHealth> => {
  // 检查HTTP服务器状态
  const serverStatus = await clientManager.getServerStatus();
  
  // 检查CLI命令处理能力
  const cliStatus = clientManager.getCLISatus();
  
  return {
    component: 'client',
    status: serverStatus.running ? 'healthy' : 'unhealthy',
    lastCheck: new Date(),
    responseTime: 0,
    details: {
      server: serverStatus,
      cli: cliStatus
    }
  };
};

// 路由器健康检查
export const routerHealthCheck = async (): Promise<ComponentHealth> => {
  // 检查配置加载状态
  const configStatus = await routerManager.getConfigStatus();
  
  // 检查路由处理能力
  const routingStatus = routerManager.getRoutingStatus();
  
  return {
    component: 'router',
    status: configStatus.loaded ? 'healthy' : 'unhealthy',
    lastCheck: new Date(),
    responseTime: 0,
    details: {
      config: configStatus,
      routing: routingStatus
    }
  };
};

// 流水线健康检查
export const pipelineHealthCheck = async (): Promise<ComponentHealth> => {
  // 检查流水线管理器状态
  const managerStatus = pipelineManager.getStatus();
  
  // 检查活跃流水线
  const activePipelines = pipelineManager.getActivePipelines();
  
  return {
    component: 'pipeline',
    status: managerStatus.initialized ? 'healthy' : 'unhealthy',
    lastCheck: new Date(),
    responseTime: 0,
    details: {
      manager: managerStatus,
      activePipelines: activePipelines.length
    }
  };
};
```

## 日志管理系统

### 日志查看器
```typescript
// log-viewer.ts
export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  details?: Record<string, any>;
}

export class LogViewer {
  private logFilePath: string;
  private maxLines: number;
  
  constructor(options: { logFilePath: string; maxLines?: number }) {
    this.logFilePath = options.logFilePath;
    this.maxLines = options.maxLines || 1000;
  }
  
  async getLogs(filters?: LogFilters): Promise<LogEntry[]> {
    try {
      const logs = await this.readLogFile();
      return this.filterLogs(logs, filters);
    } catch (error) {
      throw new Error(`Failed to read log file: ${error.message}`);
    }
  }
  
  private async readLogFile(): Promise<LogEntry[]> {
    const content = await fs.promises.readFile(this.logFilePath, 'utf-8');
    const lines = content.split('\n').slice(-this.maxLines);
    
    return lines
      .map(line => this.parseLogLine(line))
      .filter(Boolean) as LogEntry[];
  }
  
  private parseLogLine(line: string): LogEntry | null {
    try {
      // 解析JSON格式日志
      const logObj = JSON.parse(line);
      
      return {
        timestamp: new Date(logObj.timestamp),
        level: logObj.level,
        component: logObj.component,
        message: logObj.message,
        details: logObj.details
      };
    } catch {
      // 解析普通文本日志
      const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] \[(\w+)\] (.+)$/);
      if (match) {
        return {
          timestamp: new Date(match[1]),
          level: match[2] as any,
          component: match[3],
          message: match[4]
        };
      }
      
      return null;
    }
  }
  
  private filterLogs(logs: LogEntry[], filters?: LogFilters): LogEntry[] {
    if (!filters) return logs;
    
    return logs.filter(log => {
      // 按级别过滤
      if (filters.level && log.level !== filters.level) {
        return false;
      }
      
      // 按组件过滤
      if (filters.component && log.component !== filters.component) {
        return false;
      }
      
      // 按时间范围过滤
      if (filters.startDate && log.timestamp < filters.startDate) {
        return false;
      }
      
      if (filters.endDate && log.timestamp > filters.endDate) {
        return false;
      }
      
      // 按关键字过滤
      if (filters.keyword && !log.message.includes(filters.keyword)) {
        return false;
      }
      
      return true;
    });
  }
  
  async searchLogs(query: string, options?: SearchOptions): Promise<LogEntry[]> {
    const logs = await this.getLogs();
    
    return logs.filter(log => {
      // 在消息和详情中搜索
      const searchText = `${log.message} ${JSON.stringify(log.details || {})}`;
      return searchText.toLowerCase().includes(query.toLowerCase());
    }).slice(-(options?.limit || 100));
  }
}
```

## 接口定义

```typescript
interface ManagementModuleInterface {
  initialize(): Promise<void>;
  startManagementServer(port?: number): Promise<void>;
  stopManagementServer(): Promise<void>;
  getSystemStatus(): Promise<SystemStatus>;
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  getAlerts(options?: AlertOptions): Promise<Alert[]>;
  getConfig(key?: string): Promise<any>;
  updateConfig(key: string, value: any): Promise<void>;
  validateConfig(): Promise<ValidationResult>;
  getLogs(filters?: LogFilters): Promise<LogEntry[]>;
}

interface WebUIInterface {
  startServer(port: number): Promise<void>;
  stopServer(): Promise<void>;
  getServerInfo(): ServerInfo;
  serveStaticFiles(): void;
}

interface CLIManagerInterface {
  registerCommands(program: Command): void;
  executeCommand(command: string, args: string[]): Promise<void>;
  showHelp(): void;
}

interface APIManagerInterface {
  setupRoutes(): void;
  getAPIInfo(): APIInfo;
  setupWebSocket(): void;
}

interface HealthCheckInterface {
  registerComponent(component: string, checkFn: () => Promise<ComponentHealth>): void;
  checkComponent(component: string): Promise<ComponentHealth>;
  checkAllComponents(): Promise<ComponentHealth[]>;
  getOverallHealth(): Promise<OverallHealth>;
}

interface LogManagerInterface {
  getLogs(filters?: LogFilters): Promise<LogEntry[]>;
  searchLogs(query: string, options?: SearchOptions): Promise<LogEntry[]>;
  exportLogs(format: 'json' | 'csv' | 'txt', options?: ExportOptions): Promise<string>;
  clearLogs(): Promise<void>;
}
```

## 依赖关系

- 依赖配置模块获取管理配置
- 依赖监控模块获取系统状态
- 依赖日志模块获取日志信息
- 被CLI模块和Web模块调用以提供管理功能

## 设计原则

1. **用户友好**: 提供直观易用的Web界面和CLI命令
2. **实时性**: 支持实时监控和数据刷新
3. **安全性**: 实施严格的认证和授权机制
4. **可扩展性**: 支持插件化扩展和自定义功能
5. **可观测性**: 提供全面的系统状态和性能监控
6. **可配置性**: 支持灵活的配置管理和更新
7. **可靠性**: 确保管理功能的稳定性和可用性
8. **集成性**: 与主流监控和告警系统良好集成