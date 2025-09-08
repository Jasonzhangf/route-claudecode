#!/bin/bash
# Build and run specific test
npm run build && npx jest src/modules/pipeline/src/__tests__/pipeline-assembler-core.test.ts --verbose