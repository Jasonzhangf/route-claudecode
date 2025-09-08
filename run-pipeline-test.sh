#!/bin/bash

# Build first
echo "🔧 Building TypeScript..."
npm run build

echo "🧪 Running pipeline assembler core test..."
npx jest src/modules/pipeline/src/__tests__/pipeline-assembler-core.test.ts --verbose --testTimeout=30000