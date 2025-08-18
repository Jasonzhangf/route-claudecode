# 组件模块 (Components Module)

## 模块概述

组件模块是RCC v4.0系统的可复用UI和业务组件库，提供一套标准化的Vue.js组件、工具函数和业务逻辑组件，用于构建一致的用户界面和共享业务逻辑。

## 模块职责

1. **UI组件库**: 提供标准化的Vue.js UI组件
2. **业务组件**: 提供可复用的业务逻辑组件
3. **工具函数**: 提供常用的工具函数和辅助方法
4. **样式系统**: 提供统一的样式和主题系统
5. **国际化**: 提供多语言支持和本地化功能
6. **状态管理**: 提供共享的状态管理解决方案

## 模块结构

```
components/
├── README.md                          # 本模块设计文档
├── index.ts                           # 模块入口和导出
├── ui/                                # UI组件库
│   ├── buttons/                       # 按钮组件
│   │   ├── Button.vue                  # 基础按钮
│   │   ├── IconButton.vue              # 图标按钮
│   │   ├── ToggleButton.vue            # 切换按钮
│   │   └── ButtonGroup.vue             # 按钮组
│   ├── forms/                         # 表单组件
│   │   ├── Input.vue                   # 输入框
│   │   ├── Select.vue                  # 下拉选择
│   │   ├── Checkbox.vue                # 复选框
│   │   ├── Radio.vue                   # 单选框
│   │   ├── TextArea.vue                # 多行文本框
│   │   ├── Switch.vue                  # 开关组件
│   │   ├── DatePicker.vue               # 日期选择器
│   │   └── FormField.vue              # 表单字段包装器
│   ├── navigation/                     # 导航组件
│   │   ├── Sidebar.vue                 # 侧边栏
│   │   ├── Navbar.vue                  # 导航栏
│   │   ├── Tabs.vue                    # 标签页
│   │   ├── Breadcrumb.vue              # 面包屑
│   │   └── Pagination.vue              # 分页组件
│   ├── data-display/                  # 数据展示组件
│   │   ├── Table.vue                   # 表格组件
│   │   ├── Card.vue                    # 卡片组件
│   │   ├── List.vue                    # 列表组件
│   │   ├── Tree.vue                    # 树形组件
│   │   ├── Chart.vue                   # 图表组件
│   │   └── Badge.vue                   # 徽章组件
│   ├── feedback/                      # 反馈组件
│   │   ├── Modal.vue                   # 模态框
│   │   ├── Toast.vue                   # 提示框
│   │   ├── Tooltip.vue                 # 工具提示
│   │   ├── Progress.vue                # 进度条
│   │   └── Skeleton.vue                # 骨架屏
│   ├── layout/                        # 布局组件
│   │   ├── Grid.vue                    # 网格布局
│   │   ├── Container.vue               # 容器组件
│   │   ├── Header.vue                  # 头部组件
│   │   ├── Footer.vue                  # 底部组件
│   │   └── Divider.vue                 # 分割线
│   └── index.ts                       # UI组件导出
├── business/                          # 业务组件
│   ├── charts/                        # 图表业务组件
│   │   ├── SystemMonitorChart.vue      # 系统监控图表
│   │   ├── PerformanceChart.vue         # 性能图表
│   │   ├── ResourceUsageChart.vue      # 资源使用图表
│   │   └── RequestTimelineChart.vue    # 请求时间线图表
│   ├── dashboards/                    # 仪表板组件
│   │   ├── SystemDashboard.vue         # 系统仪表板
│   │   ├── PerformanceDashboard.vue    # 性能仪表板
│   │   └── UsageDashboard.vue          # 使用情况仪表板
│   ├── config/                        # 配置管理组件
│   │   ├── ConfigEditor.vue            # 配置编辑器
│   │   ├── ConfigViewer.vue            # 配置查看器
│   │   └── ConfigValidator.vue         # 配置验证器
│   ├── monitoring/                    # 监控组件
│   │   ├── SystemMonitor.vue           # 系统监控器
│   │   ├── AlertList.vue               # 告警列表
│   │   └── MetricCard.vue              # 指标卡片
│   ├── logs/                          # 日志组件
│   │   ├── LogViewer.vue               # 日志查看器
│   │   ├── LogSearch.vue               # 日志搜索
│   │   └── LogExporter.vue             # 日志导出器
│   └── index.ts                       # 业务组件导出
├── utils/                             # 工具函数
│   ├── formatting.ts                  # 格式化工具
│   ├── validation.ts                  # 验证工具
│   ├── date.ts                        # 日期工具
│   ├── number.ts                      # 数字工具
│   ├── string.ts                      # 字符串工具
│   ├── array.ts                       # 数组工具
│   ├── object.ts                      # 对象工具
│   ├── http.ts                        # HTTP工具
│   ├── storage.ts                     # 存储工具
│   └── index.ts                       # 工具函数导出
├── styles/                            # 样式系统
│   ├── themes/                        # 主题文件
│   │   ├── light.scss                  # 浅色主题
│   │   └── dark.scss                   # 深色主题
│   ├── mixins/                        # SCSS混入
│   │   ├── breakpoints.scss            # 断点混入
│   │   ├── typography.scss             # 排版混入
│   │   └── utilities.scss              # 工具混入
│   ├── variables.scss                 # 全局变量
│   ├── reset.scss                     # 重置样式
│   └── index.scss                     # 样式入口
├── composables/                       # Vue组合式函数
│   ├── useApi.ts                      # API调用组合式函数
│   ├── useModal.ts                    # 模态框组合式函数
│   ├── useToast.ts                    # 提示框组合式函数
│   ├── useTheme.ts                    # 主题组合式函数
│   ├── useForm.ts                     # 表单组合式函数
│   └── index.ts                       # 组合式函数导出
├── stores/                            # 状态存储
│   ├── system.ts                      # 系统状态存储
│   ├── config.ts                      # 配置状态存储
│   ├── monitor.ts                     # 监控状态存储
│   ├── logs.ts                        # 日志状态存储
│   └── index.ts                       # 状态存储导出
├── locales/                            # 国际化文件
│   ├── en-US.json                     # 英文翻译
│   ├── zh-CN.json                     # 中文翻译
│   └── index.ts                       # 国际化导出
└── types/                             # 组件类型定义
    ├── component-types.ts             # 组件类型定义
    ├── ui-types.ts                    # UI类型定义
    └── business-types.ts             # 业务类型定义
```

## 核心组件

### UI组件库 (UI Components Library)

#### 基础按钮组件
```vue
<!-- Button.vue -->
<template>
  <button 
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
    v-bind="$attrs"
  >
    <Spinner v-if="loading" class="spinner" />
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Spinner from './Spinner.vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
}

interface Emits {
  (e: 'click', event: MouseEvent): void;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'medium',
  disabled: false,
  loading: false,
  block: false
});

const emits = defineEmits<Emits>();

const buttonClasses = computed(() => ({
  'btn': true,
  [`btn--${props.variant}`]: true,
  [`btn--${props.size}`]: true,
  'btn--block': props.block,
  'btn--loading': props.loading,
  'btn--disabled': props.disabled
}));

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emits('click', event);
  }
};
</script>

<style scoped lang="scss">
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  position: relative;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  .spinner {
    margin-right: 8px;
  }
}

.btn--primary {
  background-color: var(--color-primary);
  color: var(--color-white);
  
  &:hover:not(:disabled) {
    background-color: var(--color-primary-hover);
  }
  
  &:active:not(:disabled) {
    background-color: var(--color-primary-active);
  }
}

.btn--secondary {
  background-color: var(--color-secondary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  
  &:hover:not(:disabled) {
    background-color: var(--color-secondary-hover);
  }
  
  &:active:not(:disabled) {
    background-color: var(--color-secondary-active);
  }
}

.btn--danger {
  background-color: var(--color-danger);
  color: var(--color-white);
  
  &:hover:not(:disabled) {
    background-color: var(--color-danger-hover);
  }
  
  &:active:not(:disabled) {
    background-color: var(--color-danger-active);
  }
}

.btn--ghost {
  background-color: transparent;
  color: var(--color-text);
  
  &:hover:not(:disabled) {
    background-color: var(--color-ghost-hover);
  }
  
  &:active:not(:disabled) {
    background-color: var(--color-ghost-active);
  }
}

.btn--small {
  padding: 4px 8px;
  font-size: 12px;
  height: 24px;
}

.btn--medium {
  padding: 8px 16px;
  font-size: 14px;
  height: 32px;
}

.btn--large {
  padding: 12px 24px;
  font-size: 16px;
  height: 40px;
}

.btn--block {
  width: 100%;
  display: flex;
}

.btn--loading {
  pointer-events: none;
}

.btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

#### 表单输入组件
```vue
<!-- Input.vue -->
<template>
  <div :class="wrapperClasses">
    <label v-if="label" :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    
    <div class="input-wrapper">
      <input
        :id="inputId"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :class="inputClasses"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
        v-bind="$attrs"
      />
      
      <div v-if="suffix" class="input-suffix">
        {{ suffix }}
      </div>
      
      <button 
        v-if="clearable && modelValue" 
        type="button" 
        class="input-clear"
        @click="clearInput"
      >
        <Icon name="close" />
      </button>
    </div>
    
    <div v-if="errorMessage" class="input-error">
      {{ errorMessage }}
    </div>
    
    <div v-else-if="helpText" class="input-help">
      {{ helpText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';

interface Props {
  modelValue?: string | number;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel';
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  clearable?: boolean;
  suffix?: string;
  errorMessage?: string;
  helpText?: string;
  size?: 'small' | 'medium' | 'large';
}

interface Emits {
  (e: 'update:modelValue', value: string | number): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'clear'): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  size: 'medium',
  disabled: false,
  readonly: false,
  required: false,
  clearable: false
});

const emits = defineEmits<Emits>();

const inputId = computed(() => `input-${Math.random().toString(36).substr(2, 9)}`);
const isFocused = ref(false);

const wrapperClasses = computed(() => ({
  'input-container': true,
  'input-container--focused': isFocused.value,
  'input-container--disabled': props.disabled,
  'input-container--error': !!props.errorMessage
}));

const inputClasses = computed(() => ({
  'input': true,
  [`input--${props.size}`]: true,
  'input--with-suffix': !!props.suffix,
  'input--with-clear': props.clearable && props.modelValue
}));

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emits('update:modelValue', target.value);
};

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false;
  emits('blur', event);
};

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true;
  emits('focus', event);
};

const clearInput = () => {
  emits('update:modelValue', '');
  emits('clear');
};
</script>

<style scoped lang="scss">
.input-container {
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.input-label {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  
  .required {
    color: var(--color-danger);
    margin-left: 2px;
  }
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  color: var(--color-text);
  background-color: var(--color-background);
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }
  
  &:disabled {
    background-color: var(--color-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  &::placeholder {
    color: var(--color-placeholder);
  }
}

.input--small {
  padding: 4px 8px;
  font-size: 12px;
}

.input--large {
  padding: 12px 16px;
  font-size: 16px;
}

.input--with-suffix {
  padding-right: 40px;
}

.input--with-clear {
  padding-right: 40px;
}

.input-suffix {
  position: absolute;
  right: 12px;
  color: var(--color-text-secondary);
  font-size: 12px;
  pointer-events: none;
}

.input-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  color: var(--color-text-secondary);
  
  &:hover {
    background-color: var(--color-hover);
    color: var(--color-text);
  }
}

.input-error {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-danger);
}

.input-help {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.input-container--focused {
  .input {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }
}

.input-container--error {
  .input {
    border-color: var(--color-danger);
    
    &:focus {
      box-shadow: 0 0 0 2px var(--color-danger-focus-ring);
    }
  }
}

.input-container--disabled {
  .input {
    background-color: var(--color-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }
}
</style>
```

### 业务组件 (Business Components)

#### 系统监控图表组件
```vue
<!-- SystemMonitorChart.vue -->
<template>
  <div class="monitor-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div class="chart-controls">
        <select v-model="timeRange" @change="updateChartData">
          <option value="1h">最近1小时</option>
          <option value="6h">最近6小时</option>
          <option value="24h">最近24小时</option>
          <option value="7d">最近7天</option>
        </select>
        <button @click="refreshData" class="refresh-btn">
          <Icon name="refresh" />
        </button>
      </div>
    </div>
    
    <div class="chart-container">
      <LineChart 
        v-if="chartData.length > 0"
        :data="chartData"
        :options="chartOptions"
        :height="300"
      />
      <div v-else class="no-data">
        <Icon name="chart" class="no-data-icon" />
        <p>暂无数据</p>
      </div>
    </div>
    
    <div class="chart-stats">
      <div class="stat-item">
        <span class="stat-label">当前值</span>
        <span class="stat-value">{{ currentValue }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">平均值</span>
        <span class="stat-value">{{ averageValue }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">最大值</span>
        <span class="stat-value">{{ maxValue }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import LineChart from '@/components/ui/charts/LineChart.vue';
import Icon from '@/components/ui/Icon.vue';
import { useMonitorStore } from '@/stores/monitor';

interface Props {
  title: string;
  metric: string;
  yAxisLabel?: string;
}

const props = defineProps<Props>();

const monitorStore = useMonitorStore();
const timeRange = ref('1h');
const chartData = ref<ChartDataPoint[]>([]);
const isLoading = ref(false);

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: false,
      title: {
        display: true,
        text: props.yAxisLabel || '数值'
      }
    },
    x: {
      type: 'time',
      time: {
        unit: getTimeUnit(timeRange.value)
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index',
      intersect: false
    }
  }
}));

const currentValue = computed(() => {
  if (chartData.value.length === 0) return 'N/A';
  const latest = chartData.value[chartData.value.length - 1];
  return formatValue(latest.value);
});

const averageValue = computed(() => {
  if (chartData.value.length === 0) return 'N/A';
  const sum = chartData.value.reduce((acc, point) => acc + point.value, 0);
  return formatValue(sum / chartData.value.length);
});

const maxValue = computed(() => {
  if (chartData.value.length === 0) return 'N/A';
  const max = Math.max(...chartData.value.map(point => point.value));
  return formatValue(max);
});

async function updateChartData() {
  isLoading.value = true;
  
  try {
    const data = await monitorStore.getMetricData({
      metric: props.metric,
      timeRange: timeRange.value
    });
    
    chartData.value = data.map(point => ({
      x: new Date(point.timestamp),
      y: point.value
    }));
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
  } finally {
    isLoading.value = false;
  }
}

async function refreshData() {
  await updateChartData();
}

function getTimeUnit(range: string): string {
  switch (range) {
    case '1h': return 'minute';
    case '6h': return 'hour';
    case '24h': return 'hour';
    case '7d': return 'day';
    default: return 'hour';
  }
}

function formatValue(value: number): string {
  if (props.metric.includes('percent') || props.metric.includes('usage')) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (props.metric.includes('bytes')) {
    return formatBytes(value);
  }
  if (props.metric.includes('requests')) {
    return value.toLocaleString();
  }
  return value.toFixed(2);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

onMounted(() => {
  updateChartData();
});

watch(() => props.metric, () => {
  updateChartData();
});
</script>

<style scoped lang="scss">
.monitor-chart {
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.chart-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--color-text-secondary);
  
  &:hover {
    background-color: var(--color-hover);
    color: var(--color-text);
  }
}

.chart-container {
  position: relative;
  height: 300px;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  
  .no-data-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  p {
    margin: 0;
    font-size: 14px;
  }
}

.chart-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}
</style>
```

## 工具函数 (Utility Functions)

### 格式化工具
```typescript
// formatting.ts
export interface FormatOptions {
  decimals?: number;
  locale?: string;
  currency?: string;
}

/**
 * 格式化数字
 */
export function formatNumber(
  value: number, 
  options: FormatOptions = {}
): string {
  const { decimals = 2, locale = 'zh-CN' } = options;
  
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * 格式化百分比
 */
export function formatPercentage(
  value: number, 
  options: FormatOptions = {}
): string {
  const { decimals = 1, locale = 'zh-CN' } = options;
  
  return (value * 100).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }) + '%';
}

/**
 * 格式化字节大小
 */
export function formatBytes(
  bytes: number, 
  options: FormatOptions = {}
): string {
  const { decimals = 1, locale = 'zh-CN' } = options;
  
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)).toLocaleString(locale) + ' ' + sizes[i];
}

/**
 * 格式化时间持续
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
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

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const target = new Date(date);
  const diff = now.getTime() - target.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return '刚刚';
  }
}
```

### 验证工具
```typescript
// validation.ts
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证必填字段
 */
export function validateRequired(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return '此字段为必填项';
  }
  return null;
}

/**
 * 验证最小长度
 */
export function validateMinLength(value: string, minLength: number): string | null {
  if (value && value.length < minLength) {
    return `最少需要${minLength}个字符`;
  }
  return null;
}

/**
 * 验证最大长度
 */
export function validateMaxLength(value: string, maxLength: number): string | null {
  if (value && value.length > maxLength) {
    return `最多允许${maxLength}个字符`;
  }
  return null;
}

/**
 * 验证正则表达式
 */
export function validatePattern(value: string, pattern: RegExp, message: string): string | null {
  if (value && !pattern.test(value)) {
    return message;
  }
  return null;
}

/**
 * 验证邮箱格式
 */
export function validateEmail(value: string): string | null {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (value && !emailPattern.test(value)) {
    return '请输入有效的邮箱地址';
  }
  return null;
}

/**
 * 验证URL格式
 */
export function validateURL(value: string): string | null {
  try {
    new URL(value);
    return null;
  } catch {
    return '请输入有效的URL地址';
  }
}

/**
 * 验证数字范围
 */
export function validateNumberRange(value: number, min?: number, max?: number): string | null {
  if (min !== undefined && value < min) {
    return `数值不能小于${min}`;
  }
  if (max !== undefined && value > max) {
    return `数值不能大于${max}`;
  }
  return null;
}

/**
 * 组合验证多个规则
 */
export function validate(value: any, rules: ValidationRule): ValidationResult {
  const errors: string[] = [];
  
  // 必填验证
  if (rules.required) {
    const requiredError = validateRequired(value);
    if (requiredError) {
      errors.push(requiredError);
    }
  }
  
  // 字符串验证
  if (typeof value === 'string') {
    // 最小长度验证
    if (rules.minLength !== undefined) {
      const minLengthError = validateMinLength(value, rules.minLength);
      if (minLengthError) {
        errors.push(minLengthError);
      }
    }
    
    // 最大长度验证
    if (rules.maxLength !== undefined) {
      const maxLengthError = validateMaxLength(value, rules.maxLength);
      if (maxLengthError) {
        errors.push(maxLengthError);
      }
    }
    
    // 正则表达式验证
    if (rules.pattern) {
      const patternError = validatePattern(value, rules.pattern, '格式不正确');
      if (patternError) {
        errors.push(patternError);
      }
    }
  }
  
  // 数字验证
  if (typeof value === 'number') {
    // 自定义数字范围验证可以在rules.custom中实现
  }
  
  // 自定义验证
  if (rules.custom) {
    const customResult = rules.custom(value);
    if (typeof customResult === 'string') {
      errors.push(customResult);
    } else if (customResult === false) {
      errors.push('验证失败');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 批量验证表单数据
 */
export function validateForm(
  data: Record<string, any>, 
  rules: Record<string, ValidationRule>
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};
  
  for (const [field, fieldRules] of Object.entries(rules)) {
    results[field] = validate(data[field], fieldRules);
  }
  
  return results;
}
```

## 样式系统 (Style System)

### 主题系统
```scss
// themes/light.scss
:root {
  // 基础颜色
  --color-white: #ffffff;
  --color-black: #000000;
  
  // 主色调
  --color-primary: #1890ff;
  --color-primary-hover: #40a9ff;
  --color-primary-active: #096dd9;
  --color-primary-light: #e6f7ff;
  
  // 次要颜色
  --color-secondary: #f5f5f5;
  --color-secondary-hover: #e8e8e8;
  --color-secondary-active: #d9d9d9;
  
  // 危险颜色
  --color-danger: #ff4d4f;
  --color-danger-hover: #ff7875;
  --color-danger-active: #d9363e;
  
  // 成功颜色
  --color-success: #52c41a;
  --color-success-hover: #73d13d;
  --color-success-active: #389e0d;
  
  // 警告颜色
  --color-warning: #faad14;
  --color-warning-hover: #ffc53d;
  --color-warning-active: #d48806;
  
  // 文本颜色
  --color-text: #262626;
  --color-text-secondary: #595959;
  --color-text-tertiary: #8c8c8c;
  --color-text-quaternary: #bfbfbf;
  --color-text-placeholder: #bfbfbf;
  
  // 背景颜色
  --color-background: #ffffff;
  --color-background-light: #fafafa;
  --color-background-dark: #f5f5f5;
  
  // 边框颜色
  --color-border: #d9d9d9;
  --color-border-light: #f0f0f0;
  --color-border-dark: #bfbfbf;
  
  // 其他颜色
  --color-disabled: #f5f5f5;
  --color-hover: rgba(0, 0, 0, 0.04);
  --color-ghost-hover: rgba(0, 0, 0, 0.08);
  --color-ghost-active: rgba(0, 0, 0, 0.12);
  --color-focus-ring: rgba(24, 144, 255, 0.2);
  --color-danger-focus-ring: rgba(255, 77, 79, 0.2);
  
  // 阴影
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  // 卡片背景
  --color-card-bg: #ffffff;
  
  // 圆角
  --border-radius-sm: 2px;
  --border-radius-md: 4px;
  --border-radius-lg: 8px;
  --border-radius-xl: 16px;
  
  // 间距
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-xxl: 48px;
  
  // 字体
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-size-xs: 10px;
  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-xxl: 20px;
  --font-size-xxxl: 24px;
  
  // 字重
  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

```scss
// themes/dark.scss
[data-theme="dark"] {
  // 基础颜色
  --color-white: #ffffff;
  --color-black: #000000;
  
  // 主色调
  --color-primary: #177ddc;
  --color-primary-hover: #1890ff;
  --color-primary-active: #095cb5;
  --color-primary-light: #112a45;
  
  // 次要颜色
  --color-secondary: #303030;
  --color-secondary-hover: #3c3c3c;
  --color-secondary-active: #484848;
  
  // 危险颜色
  --color-danger: #a61d24;
  --color-danger-hover: #b3202e;
  --color-danger-active: #80141a;
  
  // 成功颜色
  --color-success: #3c8618;
  --color-success-hover: #49aa19;
  --color-success-active: #2d6b14;
  
  // 警告颜色
  --color-warning: #d89614;
  --color-warning-hover: #e6b239;
  --color-warning-active: #b3740e;
  
  // 文本颜色
  --color-text: rgba(255, 255, 255, 0.85);
  --color-text-secondary: rgba(255, 255, 255, 0.65);
  --color-text-tertiary: rgba(255, 255, 255, 0.45);
  --color-text-quaternary: rgba(255, 255, 255, 0.25);
  --color-text-placeholder: rgba(255, 255, 255, 0.3);
  
  // 背景颜色
  --color-background: #141414;
  --color-background-light: #1f1f1f;
  --color-background-dark: #000000;
  
  // 边框颜色
  --color-border: #434343;
  --color-border-light: #303030;
  --color-border-dark: #262626;
  
  // 其他颜色
  --color-disabled: rgba(255, 255, 255, 0.08);
  --color-hover: rgba(255, 255, 255, 0.08);
  --color-ghost-hover: rgba(255, 255, 255, 0.16);
  --color-ghost-active: rgba(255, 255, 255, 0.24);
  --color-focus-ring: rgba(23, 125, 220, 0.2);
  --color-danger-focus-ring: rgba(166, 29, 36, 0.2);
  
  // 卡片背景
  --color-card-bg: #1d1d1d;
}
```

## 状态管理 (State Management)

### 系统状态存储
```typescript
// stores/system.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface SystemState {
  status: 'online' | 'offline' | 'maintenance';
  version: string;
  uptime: number;
  lastUpdate: Date;
  activeRequests: number;
  totalRequests: number;
  successRate: number;
}

export const useSystemStore = defineStore('system', () => {
  // 状态
  const systemState = ref<SystemState>({
    status: 'offline',
    version: '0.0.0',
    uptime: 0,
    lastUpdate: new Date(),
    activeRequests: 0,
    totalRequests: 0,
    successRate: 0
  });
  
  const notifications = ref<Notification[]>([]);
  
  // 计算属性
  const isOnline = computed(() => systemState.value.status === 'online');
  const isHealthy = computed(() => systemState.value.status === 'online' && systemState.value.successRate > 0.95);
  
  // Actions
  async function fetchSystemStatus(): Promise<void> {
    try {
      const response = await fetch('/api/system/status');
      const data = await response.json();
      
      if (data.success) {
        systemState.value = {
          ...systemState.value,
          ...data.data
        };
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      addNotification({
        id: Date.now().toString(),
        type: 'error',
        title: '获取系统状态失败',
        message: error.message,
        timestamp: new Date()
      });
    }
  }
  
  async function updateSystemConfig(config: Partial<SystemConfig>): Promise<void> {
    try {
      const response = await fetch('/api/system/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      const data = await response.json();
      
      if (data.success) {
        addNotification({
          id: Date.now().toString(),
          type: 'success',
          title: '配置更新成功',
          message: '系统配置已成功更新',
          timestamp: new Date()
        });
      } else {
        throw new Error(data.error || '配置更新失败');
      }
    } catch (error) {
      addNotification({
        id: Date.now().toString(),
        type: 'error',
        title: '配置更新失败',
        message: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }
  
  function addNotification(notification: Notification): void {
    notifications.value.push(notification);
    
    // 自动清除通知
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  }
  
  function removeNotification(id: string): void {
    const index = notifications.value.findIndex(n => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  }
  
  function clearNotifications(): void {
    notifications.value = [];
  }
  
  // 启动定时更新
  function startAutoRefresh(interval: number = 30000): void {
    setInterval(fetchSystemStatus, interval);
  }
  
  return {
    // 状态
    systemState,
    notifications,
    
    // 计算属性
    isOnline,
    isHealthy,
    
    // Actions
    fetchSystemStatus,
    updateSystemConfig,
    addNotification,
    removeNotification,
    clearNotifications,
    startAutoRefresh
  };
});
```

## 国际化 (Internationalization)

### 多语言支持
```typescript
// locales/index.ts
import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
});

export function setLocale(locale: string): void {
  i18n.global.locale.value = locale;
  localStorage.setItem('locale', locale);
  
  // 更新HTML语言属性
  document.documentElement.lang = locale;
}

export function getLocale(): string {
  return i18n.global.locale.value;
}

export function t(key: string, params?: Record<string, any>): string {
  return i18n.global.t(key, params);
}

// zh-CN.json
{
  "common": {
    "save": "保存",
    "cancel": "取消",
    "delete": "删除",
    "edit": "编辑",
    "create": "创建",
    "update": "更新",
    "view": "查看",
    "search": "搜索",
    "filter": "筛选",
    "reset": "重置",
    "refresh": "刷新",
    "export": "导出",
    "import": "导入",
    "download": "下载",
    "upload": "上传",
    "confirm": "确认",
    "close": "关闭"
  },
  "dashboard": {
    "title": "系统仪表板",
    "systemStatus": "系统状态",
    "activeRequests": "活跃请求",
    "cpuUsage": "CPU使用率",
    "memoryUsage": "内存使用率",
    "uptime": "运行时长",
    "recentAlerts": "最近告警"
  },
  "config": {
    "title": "配置管理",
    "providers": "Provider配置",
    "routing": "路由配置",
    "server": "服务器配置",
    "debug": "调试配置",
    "security": "安全配置"
  },
  "monitor": {
    "title": "系统监控",
    "performance": "性能监控",
    "resources": "资源监控",
    "logs": "日志管理",
    "alerts": "告警管理"
  },
  "errors": {
    "networkError": "网络连接错误",
    "serverError": "服务器内部错误",
    "notFound": "请求的资源未找到",
    "unauthorized": "未授权访问",
    "forbidden": "访问被拒绝"
  }
}

// en-US.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "update": "Update",
    "view": "View",
    "search": "Search",
    "filter": "Filter",
    "reset": "Reset",
    "refresh": "Refresh",
    "export": "Export",
    "import": "Import",
    "download": "Download",
    "upload": "Upload",
    "confirm": "Confirm",
    "close": "Close"
  },
  "dashboard": {
    "title": "System Dashboard",
    "systemStatus": "System Status",
    "activeRequests": "Active Requests",
    "cpuUsage": "CPU Usage",
    "memoryUsage": "Memory Usage",
    "uptime": "Uptime",
    "recentAlerts": "Recent Alerts"
  },
  "config": {
    "title": "Configuration Management",
    "providers": "Provider Configuration",
    "routing": "Routing Configuration",
    "server": "Server Configuration",
    "debug": "Debug Configuration",
    "security": "Security Configuration"
  },
  "monitor": {
    "title": "System Monitoring",
    "performance": "Performance Monitoring",
    "resources": "Resource Monitoring",
    "logs": "Log Management",
    "alerts": "Alert Management"
  },
  "errors": {
    "networkError": "Network connection error",
    "serverError": "Server internal error",
    "notFound": "Requested resource not found",
    "unauthorized": "Unauthorized access",
    "forbidden": "Access denied"
  }
}
```

## 接口定义

```typescript
interface ComponentsModuleInterface {
  initialize(): Promise<void>;
  registerComponent(name: string, component: Component): void;
  getComponent(name: string): Component | null;
  registerUtility(name: string, utility: Function): void;
  getUtility(name: string): Function | null;
  setTheme(theme: 'light' | 'dark'): void;
  getCurrentTheme(): 'light' | 'dark';
  setLocale(locale: string): void;
  getCurrentLocale(): string;
  loadStyles(): Promise<void>;
}

interface UIComponentInterface {
  render(props: Record<string, any>): HTMLElement;
  validateProps(props: Record<string, any>): boolean;
  getDefaultProps(): Record<string, any>;
  getEvents(): string[];
}

interface BusinessComponentInterface {
  loadData(): Promise<void>;
  refreshData(): Promise<void>;
  getSnapshot(): ComponentSnapshot;
  restoreSnapshot(snapshot: ComponentSnapshot): void;
}

interface UtilityInterface {
  name: string;
  description: string;
  parameters: Record<string, ParameterSchema>;
  execute(params: Record<string, any>): Promise<any>;
}

interface ThemeInterface {
  name: string;
  variables: Record<string, string>;
  apply(): void;
  unapply(): void;
}

interface LocaleInterface {
  language: string;
  messages: Record<string, string>;
  formatMessage(key: string, params?: Record<string, any>): string;
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string;
  formatNumber(number: number, options?: Intl.NumberFormatOptions): string;
}
```

## 依赖关系

- 不依赖其他模块（基础组件库）
- 被所有需要UI界面的模块依赖
- 被管理模块用于构建Web管理界面

## 设计原则

1. **可复用性**: 提供高度可复用的组件和工具函数
2. **一致性**: 保持UI风格和交互的一致性
3. **可访问性**: 支持无障碍访问和键盘导航
4. **响应式**: 支持不同屏幕尺寸和设备
5. **可定制性**: 支持主题定制和样式覆盖
6. **国际化**: 支持多语言和本地化
7. **性能优化**: 优化组件渲染和内存使用
8. **类型安全**: 提供完整的TypeScript类型定义
9. **文档化**: 提供详细的组件文档和使用示例
10. **测试覆盖**: 提供完善的单元测试和集成测试