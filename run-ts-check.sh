#!/bin/bash
cd /Users/fanzhang/Documents/github/route-claudecode/workspace/main-development
echo "🔍 Running TypeScript compilation check..."
npx tsc --noEmit 2>&1 | head -50