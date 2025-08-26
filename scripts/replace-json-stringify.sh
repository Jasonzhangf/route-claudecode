#!/bin/bash

# Replace JSON.stringify with JQJsonHandler throughout RCC v4.0 project
# This script systematically replaces all JSON.stringify calls with JQJsonHandler.stringifyJson

set -e

PROJECT_ROOT="/Users/fanzhang/Documents/github/route-claudecode/workspace/main-development"
cd "$PROJECT_ROOT"

echo "🔄 开始替换项目中的所有JSON.stringify调用..."

# 排除不需要处理的目录和文件
EXCLUDE_DIRS="node_modules|dist|coverage|\.git|test-debug-logs|\.claude"
EXCLUDE_FILES="\.test\.ts$|\.spec\.ts$|jq-json-handler\.ts$"

# 统计总数
TOTAL_OCCURRENCES=$(grep -r "JSON\.stringify" src/ --include="*.ts" | grep -v -E "$EXCLUDE_FILES" | wc -l)
echo "📊 找到 $TOTAL_OCCURRENCES 个JSON.stringify调用需要替换"

# 需要添加import的文件
FILES_NEED_IMPORT=()
PROCESSED_COUNT=0

# 查找所有包含JSON.stringify的.ts文件
while IFS= read -r -d '' file; do
    # 跳过测试文件和jq-json-handler文件本身
    if [[ $file =~ $EXCLUDE_FILES ]]; then
        continue
    fi
    
    # 检查文件是否包含JSON.stringify
    if grep -q "JSON\.stringify" "$file"; then
        echo "🔧 处理文件: $(basename "$file")"
        
        # 检查是否已经有JQJsonHandler的import
        if ! grep -q "import.*JQJsonHandler.*from.*jq-json-handler" "$file"; then
            # 需要添加import
            FILES_NEED_IMPORT+=("$file")
            
            # 查找合适的位置添加import（在其他import之后）
            if grep -q "^import" "$file"; then
                # 在最后一个import之后添加
                LAST_IMPORT_LINE=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
                sed -i.bak "${LAST_IMPORT_LINE}a\\
import { JQJsonHandler } from '../utils/jq-json-handler';" "$file"
                # 处理相对路径
                DEPTH=$(echo "$file" | sed 's|[^/]||g' | wc -c)
                RELATIVE_PATH=""
                for ((i=4; i<$DEPTH; i++)); do
                    RELATIVE_PATH="../$RELATIVE_PATH"
                done
                sed -i "s|from '../utils/jq-json-handler'|from '${RELATIVE_PATH}utils/jq-json-handler'|" "$file"
            else
                # 在文件开头添加import
                sed -i.bak "1i\\
import { JQJsonHandler } from '../utils/jq-json-handler';" "$file"
            fi
        fi
        
        # 替换JSON.stringify调用
        # 处理常见的模式:
        # JSON.stringify(data) -> JQJsonHandler.stringifyJson(data)
        # JSON.stringify(data, null, 2) -> JQJsonHandler.stringifyJson(data, null, 2)
        # JSON.stringify(data, replacer, space) -> JQJsonHandler.stringifyJson(data, replacer, space)
        
        sed -i.bak 's/JSON\.stringify(/JQJsonHandler.stringifyJson(/g' "$file"
        
        # 移除备份文件
        rm -f "$file.bak"
        
        PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
        echo "   ✅ 已处理: $(basename "$file") (已处理: $PROCESSED_COUNT)"
    fi
done < <(find src/ -name "*.ts" -type f -print0)

echo ""
echo "📋 处理总结:"
echo "   - 处理文件数: $PROCESSED_COUNT"
echo "   - 需要添加import的文件数: ${#FILES_NEED_IMPORT[@]}"
echo ""

if [ ${#FILES_NEED_IMPORT[@]} -gt 0 ]; then
    echo "📝 以下文件已添加JQJsonHandler导入:"
    for file in "${FILES_NEED_IMPORT[@]}"; do
        echo "   - $(basename "$file")"
    done
    echo ""
fi

# 验证替换是否成功
echo "🔍 验证替换结果..."
REMAINING_OCCURRENCES=$(grep -r "JSON\.stringify" src/ --include="*.ts" | grep -v -E "$EXCLUDE_FILES|jq-json-handler\.ts" | wc -l)

if [ "$REMAINING_OCCURRENCES" -eq 0 ]; then
    echo "✅ 所有JSON.stringify调用已成功替换为JQJsonHandler.stringifyJson!"
else
    echo "⚠️  仍有 $REMAINING_OCCURRENCES 个JSON.stringify调用未替换，请手动检查:"
    grep -r "JSON\.stringify" src/ --include="*.ts" | grep -v -E "$EXCLUDE_FILES|jq-json-handler\.ts"
fi

echo ""
echo "🎉 JSON.stringify替换完成!"