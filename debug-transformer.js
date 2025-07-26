// Debug transformer import issue
console.log('Starting transformer debug...');

try {
  // Test different import methods
  console.log('1. Testing require with .ts extension...');
  const transformers1 = require('./src/transformers/index.ts');
  console.log('Success with .ts:', Object.keys(transformers1).slice(0, 3));
} catch (error) {
  console.error('Error with .ts:', error.message);
}

try {
  console.log('2. Testing require without extension...');
  const transformers2 = require('./src/transformers/index');
  console.log('Success without extension:', Object.keys(transformers2).slice(0, 3));
} catch (error) {
  console.error('Error without extension:', error.message);
}

try {
  console.log('3. Testing require with directory...');
  const transformers3 = require('./src/transformers');
  console.log('Success with directory:', Object.keys(transformers3).slice(0, 3));
} catch (error) {
  console.error('Error with directory:', error.message);
}

try {
  console.log('4. Testing specific function import...');
  const { transformationManager } = require('./src/transformers');
  console.log('transformationManager type:', typeof transformationManager);
  console.log('transformationManager.default:', typeof transformationManager.default);
  
  if (transformationManager.default) {
    console.log('Found .default property!');
    console.log('Default type:', typeof transformationManager.default);
  }
} catch (error) {
  console.error('Error with specific import:', error.message);
  console.error('Stack:', error.stack);
}

console.log('Debug complete.');