#!/usr/bin/env node

/**
 * Rate Limit Profiling Tool
 *
 * This script sends a controlled burst of concurrent requests to a specified provider and model
 * to measure the actual rate limits (RPM, TPM) enforced by the API endpoint.
 *
 * Usage:
 * node test/performance/test-rate-limit-profiler.js --provider [providerId] --model [modelName] --rpm [requestsPerMinute] --duration [seconds]
 *
 * Example:
 * node test/performance/test-rate-limit-profiler.js --provider gemini-pro --model gemini-1.5-pro --rpm 10 --duration 60
 */

const axios = require('axios');
const { program } = require('commander');

// --- Argument Parsing ---
program
  .option('--provider <providerId>', 'The ID of the provider to test')
  .option('--model <modelName>', 'The model name to use for requests')
  .option('--rpm <number>', 'The target requests per minute to simulate', parseInt)
  .option('--duration <seconds>', 'The duration of the test in seconds', parseInt)
  .option('--port <port>', 'The port of the router server', '3456')
  .parse(process.argv);

const { provider, model, rpm, duration, port } = program.opts();

if (!provider || !model || !rpm || !duration) {
  console.error('Error: Missing required arguments. Use --help for more information.');
  process.exit(1);
}

const SERVER_URL = `http://localhost:${port}/v1/messages`;

// --- Main Test Logic ---
async function runTest() {
  console.log('--- Rate Limit Profiler ---');
  console.log(`Provider: ${provider}`);
  console.log(`Model: ${model}`);
  console.log(`Target RPM: ${rpm}`);
  console.log(`Test Duration: ${duration} seconds`);
  console.log('---------------------------');
  console.log('Starting test...');

  const totalRequests = Math.ceil(rpm * (duration / 60));
  const intervalMs = (60 * 1000) / rpm;

  console.log(`Calculated Total Requests: ${totalRequests}`);
  console.log(`Request Interval: ${intervalMs.toFixed(2)} ms`);
  console.log('---------------------------');
  process.stdout.write('Sending requests: ');

  const requestPromises = [];
  const metrics = {
    totalSent: 0,
    success: 0,
    rateLimited: 0, // 429 errors
    otherErrors: 0,
    latencies: [],
    startTime: Date.now(),
  };

  const requestBody = {
    model: model,
    messages: [{ role: 'user', content: `Rate limit test prompt #${Date.now()}` }],
    max_tokens: 10,
    // This ensures we hit the specific provider via routing rules
    metadata: {
      routingCategory: provider // Assuming you have a routing category named after your providerId
    }
  };

  let stopTest = false;

  const sendRequest = async () => {
    if (stopTest) return;
    const startTime = Date.now();
    try {
      const response = await axios.post(SERVER_URL, requestBody, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.status === 200) {
        metrics.success++;
        process.stdout.write('✅');
      }
    } catch (error) {
      if (error.response && error.response.status === 429) {
        metrics.rateLimited++;
        process.stdout.write('❌');
        if (!stopTest) {
          stopTest = true;
          console.log('\n\n🚨 Rate limit detected! Halting further requests... 🚨');
        }
      } else {
        metrics.otherErrors++;
        process.stdout.write('❗️');
        console.error(`\nOther Error: ${error.message}`);
      }
    } finally {
      if (!stopTest) {
          const latency = Date.now() - startTime;
          metrics.latencies.push(latency);
          metrics.totalSent++;
      }
    }
  };

  // --- Request Sending Loop ---
  const testEndTime = Date.now() + duration * 1000;
  let requestCounter = 0;

  const intervalId = setInterval(() => {
    if (Date.now() >= testEndTime || requestCounter >= totalRequests || stopTest) {
      clearInterval(intervalId);
      return;
    }
    requestPromises.push(sendRequest());
    requestCounter++;
  }, intervalMs);

  // Wait for the test to complete or be stopped
  while (!stopTest && Date.now() < testEndTime && requestCounter < totalRequests) {
      await new Promise(resolve => setTimeout(resolve, 100));
  }
  clearInterval(intervalId);

  await Promise.allSettled(requestPromises);
  const testActualDuration = (Date.now() - metrics.startTime) / 1000;

  console.log('\n\n--- Test Finished ---');
  console.log(`\n📈 Profiling Results (${testActualDuration.toFixed(2)}s):`);
  console.log('---------------------------');
  console.log(`Total Requests Sent: ${metrics.totalSent}`);
  console.log(`✅ Successes:         ${metrics.success}`);
  console.log(`❌ Rate Limited (429): ${metrics.rateLimited}`);
  console.log(`❗️ Other Errors:      ${metrics.otherErrors}`);
  console.log('---------------------------');

  if (metrics.latencies.length > 0) {
    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
    console.log(`⏱️ Average Latency: ${avgLatency.toFixed(2)} ms`);
  }

  const safeRpm = (metrics.success / testActualDuration) * 60;
  console.log(`📈 Measured Safe RPM (successful requests): ${safeRpm.toFixed(2)}`);
  console.log('---------------------------');

  if(metrics.rateLimited > 0) {
    console.log(`\n💡 Test stopped early due to rate limit after ${metrics.totalSent} successful requests.`);
    console.log('This suggests the real RPM limit is close to the measured RPM before the failure.');
  } else if (testActualDuration < duration - 1) {
      console.log(`\n⚠️ Test finished, but ran for a shorter duration than expected.`);
  } else {
    console.log('\n✅ No rate limits detected at the specified RPM. You might be able to increase the RPM target.');
  }


}

runTest().catch(err => {
  console.error('An unexpected error occurred:', err);
  process.exit(1);
});
