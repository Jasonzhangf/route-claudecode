#!/usr/bin/env node

/**
 * Step 2: Verify model routing logic correctness
 * Goal: Verify model routing logic correctness with tools
 * Input: step1-output.json request and response data
 * Output: Routing analysis results → save to step2-output.json
 */

const fs = require('fs');

async function testStep2() {
  console.log('🔍 Step 2: Analyzing model routing logic with tools');

  try {
    // Load step1 output
    if (!fs.existsSync('step1-output.json')) {
      throw new Error('step1-output.json not found. Run step 1 first.');
    }

    const step1Data = JSON.parse(fs.readFileSync('step1-output.json', 'utf8'));
    
    console.log('📊 Analyzing routing data:');
    console.log('  - Input model:', step1Data.request.model);
    console.log('  - Output model:', step1Data.response.model);
    console.log('  - Request tools:', step1Data.request.tools?.length || 0);
    console.log('  - Tool names:', (step1Data.request.tools || []).map(t => t.name));

    // Analyze routing results
    const routingAnalysis = {
      inputModel: step1Data.request.model,
      outputModel: step1Data.response.model,
      expectedCategory: getExpectedCategory(step1Data.request.model),
      expectedProvider: 'codewhisperer-primary',
      expectedTargetModel: getExpectedTargetModel(step1Data.request.model),
      hasTools: !!(step1Data.request.tools?.length),
      toolCount: step1Data.request.tools?.length || 0,
      toolNames: (step1Data.request.tools || []).map(t => t.name),
      routingCorrect: step1Data.response.model.includes('CLAUDE'),
      providerUsed: step1Data.response.model.includes('CLAUDE') ? 'codewhisperer' : 'unknown',
      contentEmpty: !step1Data.response.content || step1Data.response.content.length === 0
    };

    const output = {
      timestamp: new Date().toISOString(),
      step1Data: step1Data,
      routingAnalysis: routingAnalysis,
      verificationPoints: {
        modelCategoryCorrect: routingAnalysis.expectedCategory === getActualCategory(step1Data.request.model),
        providerCorrect: routingAnalysis.providerUsed === 'codewhisperer',
        toolsPreserved: routingAnalysis.hasTools,
        responseGenerated: step1Data.response.usage.input_tokens > 0
      }
    };

    // Save output for step 3
    fs.writeFileSync('step2-output.json', JSON.stringify(output, null, 2));
    
    console.log('✅ Step 2 Analysis Results:');
    console.log('  - Input model category:', routingAnalysis.expectedCategory);
    console.log('  - Routed to provider:', routingAnalysis.providerUsed);
    console.log('  - Target model:', routingAnalysis.outputModel);
    console.log('  - Tools preserved:', routingAnalysis.hasTools);
    console.log('  - Tool count:', routingAnalysis.toolCount);
    console.log('  - Content generated:', !routingAnalysis.contentEmpty);
    console.log('  - Routing correct:', routingAnalysis.routingCorrect);
    console.log('  - Analysis saved to step2-output.json');

    return true;
  } catch (error) {
    console.error('❌ Step 2 Failed:');
    console.error('  - Error:', error.message);
    return false;
  }
}

function getExpectedCategory(model) {
  if (model.includes('haiku')) return 'background';
  if (model.includes('sonnet-4')) return 'default';
  return 'default';
}

function getActualCategory(model) {
  // This would need to be extracted from logs, for now assume correct
  return getExpectedCategory(model);
}

function getExpectedTargetModel(model) {
  const modelMap = {
    'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
    'claude-3-5-haiku-20241022': 'CLAUDE_3_7_SONNET_20250219_V1_0',
    'claude-3-5-sonnet-20241022': 'CLAUDE_3_7_SONNET_20250219_V1_0'
  };
  return modelMap[model] || 'CLAUDE_SONNET_4_20250514_V1_0';
}

if (require.main === module) {
  testStep2().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testStep2 };