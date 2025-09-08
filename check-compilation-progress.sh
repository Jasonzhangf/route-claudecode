#!/bin/bash

echo "🔍 Checking TypeScript Compilation Progress After Fixes"
echo "======================================================"

cd /Users/fanzhang/Documents/github/route-claudecode/workspace/main-development

echo "Running TypeScript compilation check..."
ERROR_OUTPUT=$(npx tsc --noEmit 2>&1)
ERROR_COUNT=$(echo "$ERROR_OUTPUT" | grep "error TS" | wc -l | tr -d ' ')

echo ""
echo "📊 COMPILATION RESULTS:"
echo "Current TypeScript error count: $ERROR_COUNT"
echo ""

if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "🎉 SUCCESS! All TypeScript errors have been fixed!"
    echo "✅ The codebase now compiles without errors."
elif [ "$ERROR_COUNT" -le 5 ]; then
    echo "🚀 EXCELLENT PROGRESS! Only $ERROR_COUNT errors remaining!"
    echo "We're very close to a clean compilation."
elif [ "$ERROR_COUNT" -le 10 ]; then
    echo "✅ GOOD PROGRESS! Down to $ERROR_COUNT errors."
    echo "Most issues have been resolved."
else
    echo "📈 PROGRESS MADE! $ERROR_COUNT errors remaining."
    echo "Continue with systematic fixes."
fi

echo ""
echo "📈 Progress Summary:"
echo "Original errors: 336"
echo "Previous count: 33"  
echo "Current count: $ERROR_COUNT"
echo "Total fixed: $((336 - ERROR_COUNT))"
echo "Recent fixes: $((33 - ERROR_COUNT))"
echo "Completion: $(( (336 - ERROR_COUNT) * 100 / 336 ))%"

if [ "$ERROR_COUNT" -gt 0 ]; then
    echo ""
    echo "🔍 Remaining Error Types:"
    echo "$ERROR_OUTPUT" | grep "error TS" | sed 's/.*error \(TS[0-9]*\):.*/\1/' | sort | uniq -c | sort -nr | head -5
    
    echo ""
    echo "📁 Most Affected Files:"
    echo "$ERROR_OUTPUT" | grep "error TS" | sed 's/^\([^(]*\)(.*/\1/' | sort | uniq -c | sort -nr | head -5
fi