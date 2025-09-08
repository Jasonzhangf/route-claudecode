# RCC v4.0 模块编译系统说明

## 概述

RCC v4.0采用模块化架构，每个功能模块独立编译。新的编译流程旨在让项目根目录更加干净，避免显示临时的`compiled-modules`目录。

## 编译脚本

### compile-module.sh
- **用途**：编译单个模块
- **用法**：`./scripts/compile-module.sh <module-name>`
- **流程**：
  1. 将模块源码编译到临时目录`compiled-modules/<module-name>`
  2. 将编译产物移动到最终目录`node_modules/@rcc/<module-name>`
  3. 清理临时目录

### compile-all.sh
- **用途**：编译所有模块
- **用法**：`./scripts/compile-all.sh`
- **流程**：
  1. 逐个编译所有模块（使用compile-module.sh）
  2. 生成模块API网关
  3. 清理临时的`compiled-modules`目录

## 模块引用方式

编译后的模块可以通过标准npm包方式引用：

```javascript
const config = require('@rcc/config');
const router = require('@rcc/router');
// 等等
```

## 目录结构

编译完成后，模块将位于：
```
node_modules/
└── @rcc/
    ├── config/
    ├── router/
    ├── api/
    └── ... 其他模块
```

项目根目录将保持干净，不显示临时的`compiled-modules`目录。

## 工作原理

1. **编译阶段**：模块源码按照原有的TypeScript配置编译到`compiled-modules`临时目录
2. **移动阶段**：将编译产物从临时目录移动到`node_modules/@rcc/`目录
3. **清理阶段**：删除临时的`compiled-modules`目录，保持项目根目录干净

这种方式既保持了原有编译机制的正确性，又实现了用户希望的干净目录结构。