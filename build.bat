@echo off
REM Build script for Windows
REM Clean and build the project

setlocal

echo [34m🔨 Building Route Claude Code (Windows)...[0m
echo [34m=======================================[0m

REM Clean dist directory
echo [34m🧹 Cleaning dist directory...[0m
if exist dist rmdir /s /q dist
echo [32m✅ Dist directory cleaned[0m

REM Run TypeScript compiler
echo [34m📝 Running TypeScript compiler...[0m
call npx tsc
if errorlevel 1 (
    echo [31m❌ TypeScript compilation failed[0m
    exit /b 1
)
echo [32m✅ TypeScript compilation completed[0m

REM Run esbuild
echo [34m📦 Running esbuild bundling...[0m
call npx esbuild src/cli.ts --bundle --platform=node --outfile=dist/cli.js --external:tiktoken --external:@anthropic-ai/sdk --banner:js="#!/usr/bin/env node"
if errorlevel 1 (
    echo [31m❌ esbuild bundling failed[0m
    exit /b 1
)
echo [32m✅ esbuild bundling completed[0m

echo.
echo [32m🎉 Build completed successfully![0m
echo [32m===========================[0m

endlocal