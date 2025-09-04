# TypeScript声明文件模块隔离架构

## 🎯 核心理念

为RCC v4.0实现基于TypeScript声明文件的模块隔离架构：
- **接口隔离**：只暴露.d.ts声明文件，隐藏具体实现
- **编译隔离**：每个模块独立编译，局部更新
- **类型安全**：保持完整的TypeScript类型检查
- **开发效率**：支持增量编译和监听更新

## 🏗️ 目录结构设计

```
project/
├── src/modules/              # 模块源码目录(开发时)
│   ├── config/              # 配置管理模块
│   │   ├── src/             # TypeScript源码
│   │   ├── tests/           # 模块测试
│   │   └── tsconfig.json    # 模块编译配置
│   ├── router/              # 路由器模块
│   ├── pipeline/            # 流水线模块
│   └── scheduler/           # 调度器模块
├── compiled/                # 编译产物目录
│   ├── config/              # 配置模块编译产物
│   │   ├── index.js         # 编译后JavaScript
│   │   └── index.d.ts       # TypeScript声明文件
│   ├── router/
│   ├── pipeline/
│   └── scheduler/
├── scripts/                 # 编译管理脚本
│   ├── compile-module.sh    # 单模块编译
│   ├── compile-all.sh       # 全量编译
│   └── watch-module.sh      # 监听编译
└── dist/                    # 最终构建产物
```

## 🔧 模块编译配置

### 模块tsconfig.json示例
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS", 
    "declaration": true,
    "outDir": "../../../compiled/config",
    "rootDir": "./src",
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*"]
}
```

### 主应用配置
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@rcc/config": ["./compiled/config"],
      "@rcc/router": ["./compiled/router"],
      "@rcc/pipeline": ["./compiled/pipeline"],
      "@rcc/scheduler": ["./compiled/scheduler"]
    }
  }
}
```

## 📦 声明文件示例

### 配置模块声明文件
```typescript
/**
 * 配置管理模块 - 外部API声明
 * ⚠️ 编译生成，请勿手动修改
 */

export interface ConfigPreprocessResult {
  success: boolean;
  routingTable?: RoutingTable;
  errors: string[];
  stats: {
    providersCount: number;
    routesCount: number;
    processingTimeMs: number;
  };
}

export declare class ConfigPreprocessor {
  static preprocess(configPath: string): Promise<ConfigPreprocessResult>;
  // ❌ 内部方法完全隐藏
  // private static _validateConfig(): void;
}
```

## 🔨 编译脚本

### 单模块编译
```bash
#!/bin/bash
# compile-module.sh

MODULE_NAME=$1
MODULE_PATH="src/modules/$MODULE_NAME"
OUTPUT_PATH="compiled/$MODULE_NAME"

echo "🔧 编译模块: $MODULE_NAME"

# 清理旧产物
rm -rf "$OUTPUT_PATH"
mkdir -p "$OUTPUT_PATH"

# 编译TypeScript
cd "$MODULE_PATH"
npx tsc --build

# 验证编译产物
if [ ! -f "../../$OUTPUT_PATH/index.js" ] || [ ! -f "../../$OUTPUT_PATH/index.d.ts" ]; then
  echo "❌ 编译失败"
  exit 1
fi

echo "✅ 模块 '$MODULE_NAME' 编译完成"
```

### 全量编译
```bash
#!/bin/bash
# compile-all.sh

MODULES=("config" "router" "pipeline" "scheduler")
SUCCESS_COUNT=0

for MODULE in "${MODULES[@]}"; do
  echo "编译模块: $MODULE"
  if ./scripts/compile-module.sh "$MODULE"; then
    ((SUCCESS_COUNT++))
  fi
done

echo "编译完成: $SUCCESS_COUNT/${#MODULES[@]}"
```

## 🎯 使用流程

### 开发阶段
1. 在`src/modules/<module>/src/`中开发模块
2. 编写测试：`src/modules/<module>/tests/`
3. 单模块编译：`./scripts/compile-module.sh <module>`
4. 验证接口：检查生成的.d.ts文件

### 集成阶段
```typescript
// ✅ 正确：使用编译后模块
import { ConfigPreprocessor } from '@rcc/config';

// ❌ 错误：直接导入源码
import { ConfigPreprocessor } from '../modules/config/src/...';
```

### 更新流程
1. 修改模块源码
2. 运行模块测试
3. 重新编译模块：`./scripts/compile-module.sh <module>`
4. 验证接口兼容性
5. 更新应用程序

## 📋 质量保证

### 编译验证
- 类型检查：确保.d.ts完整
- 接口验证：源码与声明一致
- 依赖检查：模块依赖正确

### 自动化
```json
{
  "scripts": {
    "compile:all": "./scripts/compile-all.sh",
    "compile:watch": "./scripts/watch-module.sh",
    "verify:types": "tsc --noEmit"
  }
}
```

## 🚀 实施步骤

1. **设置架构**：创建目录结构和编译脚本
2. **重构模块**：将现有模块迁移到新架构  
3. **集成测试**：验证模块间接口
4. **优化工具**：完善编译和监听工具
5. **文档完善**：更新开发指南

这个架构确保了模块完全隔离，保持开发效率和类型安全。