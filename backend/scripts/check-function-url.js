require('dotenv').config({ path: '../.env' });
const { LambdaClient, GetFunctionUrlConfigCommand, GetPolicyCommand } = require('@aws-sdk/client-lambda');

const client = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const FUNCTION_NAME = 'PersonalAssistant_WebhookHandler';

async function checkConfig() {
    try {
        // Check URL Config
        const urlConfig = await client.send(new GetFunctionUrlConfigCommand({ FunctionName: FUNCTION_NAME }));
        console.log('URL Config:', JSON.stringify(urlConfig, null, 2));

        // Check Policy
        const policy = await client.send(new GetPolicyCommand({ FunctionName: FUNCTION_NAME }));
        console.log('Policy:', JSON.stringify(JSON.parse(policy.Policy), null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

checkConfig();
