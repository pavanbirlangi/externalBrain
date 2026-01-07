require('dotenv').config({ path: '../.env' });
const { LambdaClient, GetFunctionUrlConfigCommand, CreateFunctionUrlConfigCommand, AddPermissionCommand } = require('@aws-sdk/client-lambda');

const client = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FUNCTION_NAME = 'PersonalAssistant_WebhookHandler';

async function setWebhook() {
    try {
        let functionUrl;

        // 1. Get or Create Function URL
        try {
            const response = await client.send(new GetFunctionUrlConfigCommand({ FunctionName: FUNCTION_NAME }));
            functionUrl = response.FunctionUrl;
            console.log('Existing Function URL:', functionUrl);
        } catch (err) {
            if (err.name === 'ResourceNotFoundException') {
                const response = await client.send(new CreateFunctionUrlConfigCommand({
                    FunctionName: FUNCTION_NAME,
                    AuthType: 'NONE',
                }));
                functionUrl = response.FunctionUrl;
                console.log('Created Function URL:', functionUrl);

                // Add permission for public access (AuthType NONE needs resource policy)
                await client.send(new AddPermissionCommand({
                    FunctionName: FUNCTION_NAME,
                    StatementId: 'FunctionURLAllowPublicAccess',
                    Action: 'lambda:InvokeFunctionUrl',
                    Principal: '*',
                    FunctionUrlAuthType: 'NONE',
                }));
                console.log('Added public access permission.');
            } else {
                throw err;
            }
        }

        // 2. Set Telegram Webhook
        const webhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${functionUrl}`;
        const response = await fetch(webhookUrl);
        const data = await response.json();

        if (data.ok) {
            console.log('Telegram Webhook Set Successfully!');
            console.log('Webhook URL:', functionUrl);
        } else {
            console.error('Failed to set webhook:', data.description);
        }

    } catch (error) {
        console.error('Error setting webhook:', error);
    }
}

setWebhook();
