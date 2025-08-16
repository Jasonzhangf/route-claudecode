#!/bin/bash

# 同步所有worktree到最新状态
echo "🔄 开始同步worktree..."

# 获取当前主仓库目录
MAIN_REPO="/Users/fanzhang/Documents/github/route-claudecode"
MODULE_DEVELOPER_WORKTREE="$MAIN_REPO/workspace/module-developer"

echo "📋 更新module-developer worktree..."

# 切换到module-developer worktree并更新
cd "$MODULE_DEVELOPER_WORKTREE" || exit 1

# 获取最新更改
git fetch origin

# 合并main分支的更新
git merge origin/main

echo "✅ module-developer worktree更新完成"

echo "📊 当前worktree状态："
cd "$MAIN_REPO"
git worktree list

echo "🎯 任务分配更新完成！"
echo "📋 module-developer现在可以开始执行新分配的任务："
echo "   - Provider系统实际测试和完善"
echo "   - 负载均衡和高可用性实现"  
echo "   - 缓存和优化系统"
echo "   - Debug和开发工具"