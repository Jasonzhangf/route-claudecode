# RCC v4.0 模块系统改进方案

## 当前问题

当前RCC v4.0项目的模块系统存在以下问题：

1. 编译后的模块存储在`compiled-modules`目录中，而不是标准的`node_modules`结构
2. 全局安装时，这些编译后的模块没有被正确安装到全局`node_modules`中
3. 项目使用了自定义的编译和模块系统，而不是标准的npm工作区
4. 模块之间的依赖关系管理不够清晰

## 改进方案

### 1. 创建本地npm包结构

为`compiled-modules`目录中的每个模块创建`package.json`文件，使其成为独立的npm包，命名规范为`@rcc/<module-name>`。

### 2. 使用软链接集成到node_modules

创建一个构建脚本，在构建过程中将`compiled-modules`目录中的模块通过软链接链接到`node_modules/@rcc/`目录中，实现标准的npm包引用方式。

### 3. 改进的构建和安装流程

创建`scripts/improved-build-and-install.sh`脚本，该脚本将：

1. 编译TypeScript代码到`dist`目录
2. 编译模块到`compiled-modules`目录
3. 创建软链接将`compiled-modules`中的模块链接到`node_modules/@rcc/`
4. 安装依赖
5. 全局安装CLI工具

## 使用方法

### 开发环境使用

```bash
# 使用改进的构建脚本
./scripts/improved-build-and-install.sh
```

### 代码中引用模块

```javascript
// 现在可以使用标准的npm包引用方式
const config = require('@rcc/config');
const router = require('@rcc/router');
// 等等
```

### 全局安装后使用

```bash
# 全局安装后，模块也会被正确安装到全局node_modules中
rcc4 start --config ~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json --port 5506
```

## 优势

1. **标准化**: 使用标准的npm包结构和引用方式
2. **兼容性**: 与现有的npm生态系统兼容
3. **全局安装**: 全局安装时模块也能正确安装到全局node_modules中
4. **开发体验**: 改善了开发体验，可以使用标准的npm工具进行模块管理
5. **维护性**: 更容易维护和扩展模块系统

## 实施步骤

1. 为所有模块创建`package.json`文件
2. 创建软链接脚本
3. 更新构建流程
4. 测试新的模块系统
5. 文档化新的使用方式

## 注意事项

1. 确保在支持软链接的操作系统上运行
2. 全局安装时可能需要管理员权限
3. 现有的代码引用方式需要更新为新的标准引用方式