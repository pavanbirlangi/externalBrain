require('dotenv').config({ path: '../.env' });
const { ApiGatewayV2Client, CreateApiCommand, CreateStageCommand, CreateIntegrationCommand, CreateRouteCommand } = require('@aws-sdk/client-apigatewayv2');
const { LambdaClient, AddPermissionCommand } = require('@aws-sdk/client-lambda');

const client = new ApiGatewayV2Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const FUNCTION_ARN = 'arn:aws:lambda:ap-south-1:518029233911:function:PersonalAssistant_WebhookHandler'; // Hardcoded from logs
const API_NAME = 'PersonalAssistantWebhookAPI';

async function setupApiGateway() {
    try {
        // 1. Create HTTP API
        const createApi = new CreateApiCommand({
            Name: API_NAME,
            ProtocolType: 'HTTP',
        });
        const api = await client.send(createApi);
        console.log('API Created:', api.ApiId);
        const apiEndpoint = api.ApiEndpoint;

        // 2. Create Integration
        const createIntegration = new CreateIntegrationCommand({
            ApiId: api.ApiId,
            IntegrationType: 'AWS_PROXY',
            IntegrationUri: FUNCTION_ARN,
            PayloadFormatVersion: '2.0',
        });
        const integration = await client.send(createIntegration);
        console.log('Integration Created:', integration.IntegrationId);

        // 3. Create Route
        const createRoute = new CreateRouteCommand({
            ApiId: api.ApiId,
            RouteKey: 'POST /',
            Target: `integrations/${integration.IntegrationId}`,
        });
        await client.send(createRoute);
        console.log('Route Created');

        // 4. Create Stage (Auto-deploy)
        // HTTP APIs have a $default stage that auto-deploys by default if not specified? 
        // Actually, createApi usually creates a $default stage if not specified? 
        // Let's check or create one.
        // Wait, CreateApi doesn't create stage automatically? 
        // Usually for HTTP API, we can just use $default.

        const createStage = new CreateStageCommand({
            ApiId: api.ApiId,
            StageName: '$default',
            AutoDeploy: true,
        });
        try {
            await client.send(createStage);
            console.log('Stage Created');
        } catch (e) {
            console.log('Stage might already exist:', e.message);
        }

        // 5. Add Permission to Lambda
        try {
            await lambdaClient.send(new AddPermissionCommand({
                FunctionName: FUNCTION_ARN,
                StatementId: `AllowApiGatewayInvoke-${Date.now()}`,
                Action: 'lambda:InvokeFunction',
                Principal: 'apigateway.amazonaws.com',
                SourceArn: `arn:aws:execute-api:${process.env.AWS_REGION}:518029233911:${api.ApiId}/*/*/`,
            }));
            console.log('Lambda Permission Added');
        } catch (e) {
            console.log('Permission error (might exist):', e.message);
        }

        console.log('API Gateway URL:', apiEndpoint);

        // Update Webhook
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const webhookUrl = `${apiEndpoint}/`;
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
        const data = await response.json();
        console.log('Webhook Update Result:', data);

    } catch (error) {
        console.error('Error setting up API Gateway:', error);
    }
}

setupApiGateway();
