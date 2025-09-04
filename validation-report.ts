import * as fs from 'fs';

const originalConfigPath = '/Users/fanzhang/.route-claudecode/config.json';
const routingTablePath = './test-outputs/routing-table.json';
const pipelineConfigsPath = './test-outputs/pipeline-configs.json';

// Load files
const originalConfig = JSON.parse(fs.readFileSync(originalConfigPath, 'utf8'));
const routingTable = JSON.parse(fs.readFileSync(routingTablePath, 'utf8'));
const pipelineConfigs = JSON.parse(fs.readFileSync(pipelineConfigsPath, 'utf8'));

// Validation Report
const validation = {
  providersValidation: {
    originalCount: originalConfig.Providers?.length || 0,
    processedCount: routingTable.providers?.length || 0,
    matches: [],
    mismatches: []
  },
  routesValidation: {
    originalRoutes: originalConfig.router || {},
    processedRoutes: routingTable.routes || {},
    exactMatches: [],
    mismatches: []
  },
  serverValidation: {
    originalServer: originalConfig.server || {},
    processedServer: routingTable.server || {},
    matches: [],
    mismatches: []
  },
  pipelineValidation: {
    totalPipelines: pipelineConfigs.length,
    sixLayerCompliance: [],
    providerEndpointMatches: []
  }
};

// Validate providers
for (const originalProvider of originalConfig.Providers || []) {
  const processedProvider = routingTable.providers.find(p => p.name === originalProvider.name);
  if (processedProvider) {
    const match = {
      name: originalProvider.name,
      apiBaseUrlMatch: processedProvider.api_base_url === originalProvider.api_base_url,
      apiKeyMatch: processedProvider.api_key === originalProvider.api_key,
      modelsMatch: JSON.stringify(processedProvider.models) === JSON.stringify(originalProvider.models),
      priorityMatch: processedProvider.priority === originalProvider.priority
    };
    validation.providersValidation.matches.push(match);
  } else {
    validation.providersValidation.mismatches.push(`Provider ${originalProvider.name} not found in processed data`);
  }
}

// Validate routes
for (const [routeName, routeValue] of Object.entries(originalConfig.router || {})) {
  if (routingTable.routes[routeName] === routeValue) {
    validation.routesValidation.exactMatches.push(`${routeName}: ${routeValue}`);
  } else {
    validation.routesValidation.mismatches.push(`${routeName}: expected ${routeValue}, got ${routingTable.routes[routeName]}`);
  }
}

// Validate server configuration
const serverKeys = ['port', 'host', 'debug'];
for (const key of serverKeys) {
  const originalValue = originalConfig.server?.[key];
  const processedValue = routingTable.server?.[key];
  if (originalValue === processedValue) {
    validation.serverValidation.matches.push(`${key}: ${originalValue}`);
  } else {
    validation.serverValidation.mismatches.push(`${key}: expected ${originalValue}, got ${processedValue}`);
  }
}

// Validate pipeline configurations
for (const pipeline of pipelineConfigs) {
  // Check six-layer compliance
  const hasSixLayers = pipeline.layers.length === 6;
  const expectedLayers = ['client', 'router', 'transformer', 'protocol', 'server-compatibility', 'server'];
  const layerNames = pipeline.layers.map(l => l.name);
  const correctLayerOrder = JSON.stringify(layerNames) === JSON.stringify(expectedLayers);
  
  validation.pipelineValidation.sixLayerCompliance.push({
    pipelineId: pipeline.pipelineId,
    hasSixLayers,
    correctLayerOrder,
    layerNames
  });
  
  // Check provider endpoint matches
  const originalProvider = originalConfig.Providers?.find(p => p.name === pipeline.provider);
  if (originalProvider) {
    validation.pipelineValidation.providerEndpointMatches.push({
      pipelineId: pipeline.pipelineId,
      provider: pipeline.provider,
      endpointMatch: pipeline.endpoint === originalProvider.api_base_url,
      apiKeyMatch: pipeline.apiKey === originalProvider.api_key
    });
  }
}

// Summary
const summary = {
  totalValidations: {
    providersMatched: validation.providersValidation.matches.length,
    providersMismatched: validation.providersValidation.mismatches.length,
    routesMatched: validation.routesValidation.exactMatches.length,
    routesMismatched: validation.routesValidation.mismatches.length,
    serverMatched: validation.serverValidation.matches.length,
    serverMismatched: validation.serverValidation.mismatches.length,
    pipelinesWithSixLayers: validation.pipelineValidation.sixLayerCompliance.filter(p => p.hasSixLayers).length,
    pipelinesWithCorrectOrder: validation.pipelineValidation.sixLayerCompliance.filter(p => p.correctLayerOrder).length
  }
};

const fullReport = {
  timestamp: new Date().toISOString(),
  originalConfigFile: originalConfigPath,
  generatedFiles: {
    routingTable: routingTablePath,
    pipelineConfigs: pipelineConfigsPath
  },
  validation,
  summary,
  overallSuccess: (
    validation.providersValidation.mismatches.length === 0 &&
    validation.routesValidation.mismatches.length === 0 &&
    validation.serverValidation.mismatches.length === 0 &&
    validation.pipelineValidation.sixLayerCompliance.every(p => p.hasSixLayers && p.correctLayerOrder)
  )
};

// Save validation report
fs.writeFileSync('./test-outputs/validation-report.json', JSON.stringify(fullReport, null, 2));

// Also create a human-readable summary
const readableSummary = [
  '=== RCC v4.0 Configuration Preprocessor Validation Report ===',
  '',
  `Timestamp: ${fullReport.timestamp}`,
  `Original Config: ${originalConfigPath}`,
  '',
  '📊 PROVIDERS VALIDATION:',
  `  ✅ Matched: ${summary.totalValidations.providersMatched}`,
  `  ❌ Mismatched: ${summary.totalValidations.providersMismatched}`,
  '',
  '📊 ROUTES VALIDATION:',
  `  ✅ Exact matches: ${summary.totalValidations.routesMatched}`,
  `  ❌ Mismatched: ${summary.totalValidations.routesMismatched}`,
  '',
  '📊 SERVER VALIDATION:',
  `  ✅ Matched: ${summary.totalValidations.serverMatched}`,
  `  ❌ Mismatched: ${summary.totalValidations.serverMismatched}`,
  '',
  '📊 PIPELINE VALIDATION:',
  `  ✅ Six-layer compliance: ${summary.totalValidations.pipelinesWithSixLayers}/${pipelineConfigs.length}`,
  `  ✅ Correct layer order: ${summary.totalValidations.pipelinesWithCorrectOrder}/${pipelineConfigs.length}`,
  '',
  `🎯 OVERALL RESULT: ${fullReport.overallSuccess ? 'PASSED ✅' : 'FAILED ❌'}`,
  ''
].join('\n');

fs.writeFileSync('./test-outputs/validation-summary.txt', readableSummary);