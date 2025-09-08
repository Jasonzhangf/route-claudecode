# RCC v4.0 模块编译系统改进

## 概述

为了改善项目结构，RCC v4.0采用了新的模块编译和目录管理方案，确保项目根目录保持干净，同时提供标准化的模块引用方式。

## 目标

1. **目录结构清洁**: 项目根目录不显示临时的`compiled-modules`目录
2. **标准化引用**: 使用标准npm包方式引用模块 (`@rcc/<module-name>`)
3. **全局安装兼容**: 全局安装时模块也能正确安装到全局目录中
4. **开发体验**: 改善开发体验，使用标准的npm工具进行模块管理

## 实现方案

### 编译流程

新的编译流程包括三个阶段：

1. **编译阶段**: 模块源码按照原有的TypeScript配置编译到临时目录`compiled-modules/<module-name>`
2. **移动阶段**: 将编译产物从临时目录移动到`node_modules/@rcc/<module-name>`目录
3. **清理阶段**: 删除临时的`compiled-modules`目录，保持项目根目录干净

### 目录结构

编译完成后，模块将位于标准npm包结构中：
```
node_modules/
└── @rcc/
    ├── config/
    ├── router/
    ├── api/
    └── ... 其他模块
```

项目根目录将保持干净，不显示临时的`compiled-modules`目录。

## 编译脚本

### compile-module.sh

- **用途**: 编译单个模块
- **用法**: `./scripts/compile-module.sh <module-name>`
- **流程**:
  1. 将模块源码编译到临时目录`compiled-modules/<module-name>`
  2. 将编译产物移动到最终目录`node_modules/@rcc/<module-name>`
  3. 清理临时目录

### compile-all.sh

- **用途**: 编译所有模块
- **用法**: `./scripts/compile-all.sh`
- **流程**:
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

TypeScript项目中可以使用ES6导入语法：

```typescript
import * as config from '@rcc/config';
import * as router from '@rcc/router';
// 等等
```

## 优势

1. **标准化**: 使用标准的npm包结构和引用方式
2. **兼容性**: 与现有的npm生态系统兼容
3. **开发体验**: 改善了开发体验，可以使用标准的npm工具进行模块管理
4. **维护性**: 更容易维护和扩展模块系统
5. **目录清洁**: 项目根目录保持干净，没有临时编译目录

## 验证

通过以下方式验证模块系统是否正常工作：

1. 检查`node_modules/@rcc`目录是否存在
2. 验证关键模块是否已正确编译和移动
3. 测试模块导入功能

```bash
# 运行模块系统测试
./scripts/test-module-system.sh
```