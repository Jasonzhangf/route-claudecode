const fs = require('fs');
const path = require('path');
const moduleAlias = require('module-alias');

// Register alias
moduleAlias.addAlias('@', path.join(__dirname, '../../dist'));

// Dynamically import the converter
async function runTest() {
    try {
        // Load the complex request from the JSON file
        const requestInputPath = path.join(__dirname, 'complex-request-input.json');
        const sampleRequest = JSON.parse(fs.readFileSync(requestInputPath, 'utf8'));
        // If there's a real config file, load it to get the right token file path
        let tokenFilePath = null;
        const configPath = path.join(process.env.HOME, '.claude-code-router', 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.providers && config.providers['codewhisperer-primary'] && 
                    config.providers['codewhisperer-primary'].auth && 
                    config.providers['codewhisperer-primary'].auth.tokenFile) {
                    tokenFilePath = config.providers['codewhisperer-primary'].auth.tokenFile;
                }
            } catch (parseError) {
                console.warn('Could not parse config file:', parseError.message);
            }
        }

        // Fallback to a default path if not found in config
        if (!tokenFilePath) {
            tokenFilePath = path.join(process.env.HOME, '.aws', 'sso', 'cache', 'kiro-auth-token.json');
        }

        // Check if token file exists
        if (!fs.existsSync(tokenFilePath)) {
            console.error('Token file not found at:', tokenFilePath);
            console.error('Please ensure the CodeWhisperer provider is properly configured.');
            process.exit(1);
        }

        // Import the converter dynamically
        const { CodeWhispererConverter } = await import('../../dist/providers/codewhisperer/converter.js');
        
        // Create converter instance
        // Get profile ARN from token file
        const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
        const profileArn = tokenData.profileArn;

        if (!profileArn) {
            throw new Error('profileArn not found in token file');
        }

        const converter = new CodeWhispererConverter(profileArn);
        
        // Build the CodeWhisperer request
        const cwRequest = converter.convertRequest(sampleRequest, 'test-request-id');
        
        // Pretty print the request body
        console.log('Generated CodeWhisperer Request Body:');
        console.log(JSON.stringify(cwRequest, null, 2));
        
        console.log('\n--- Test completed successfully ---');
        console.log('Save this output to compare with demo2 implementation');
        
    } catch (error) {
        console.error('Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

runTest();