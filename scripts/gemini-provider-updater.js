#!/usr/bin/env node

/**
 * RCC Gemini Provider Model Updater
 * 
 * 通过Google Gemini API检查可用模型并更新配置
 * 支持筛选2.5和2.0模型，实现多key轮询和降级策略
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { parseJsonString, stringifyJson } = require('../src/utils/jq-json-handler');

// Gemini配置路径
const GEMINI_CONFIG_PATH = '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-google-gemini-v3-5502.json';

// Gemini API配置
const GEMINI_API = {
  endpoint: 'https://generativelanguage.googleapis.com',
  listModelsPath: 'v1beta/models',
  apiKeys: [
    'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
    'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA',
    'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
  ]
};

/**
 * 发送HTTPS请求到Gemini API
 */