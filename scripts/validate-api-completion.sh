#!/bin/bash
# 验证API功能的脚本

echo "🧪 验证API功能..."

# 检查API相关文件是否存在
echo "1. 检查API相关文件..."
FILES=(
    "src/api/internal-api-client.ts"
    "src/api/server.ts"
    "src/api/modules/pipeline-layers-api-processor.ts"
    "src/api/modules/module-management-api.ts"
    "src/api/routes/pipeline-routes.ts"
    "src/api/routes/module-management-routes.ts"
    "src/api/types/api-response.ts"
    "src/interfaces/api/pipeline-api.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 不存在"
    fi
done

# 检查API端点
echo "2. 检查API端点..."
if grep -q "router.post.*/api/v1/pipeline/router/process" src/api/routes/pipeline-routes.ts; then
    echo "✅ Router API端点存在"
else
    echo "❌ Router API端点不存在"
fi

if grep -q "router.post.*/api/v1/pipeline/transformer/process" src/api/routes/pipeline-routes.ts; then
    echo "✅ Transformer API端点存在"
else
    echo "❌ Transformer API端点不存在"
fi

if grep -q "router.post.*/api/v1/modules/.*/create" src/api/routes/module-management-routes.ts; then
    echo "✅ 模块创建API端点存在"
else
    echo "❌ 模块创建API端点不存在"
fi

echo "✅ API功能验证完成"