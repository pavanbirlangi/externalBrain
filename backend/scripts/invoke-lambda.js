require('dotenv').config({ path: '../.env' });
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const client = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const FUNCTION_NAME = 'PersonalAssistant_WebhookHandler';

async function invoke() {
    try {
        const payload = {
            body: JSON.stringify({
                message: {
                    text: "Direct Invocation Test",
                    chat: { id: 123456789 }, // Mock Chat ID
                    from: { id: 123456789 }
                }
            })
        };

        const command = new InvokeCommand({
            FunctionName: FUNCTION_NAME,
            Payload: JSON.stringify(payload),
        });

        const response = await client.send(command);
        const result = JSON.parse(new TextDecoder().decode(response.Payload));

        console.log('Invocation Result:', result);

    } catch (error) {
        console.error('Error invoking lambda:', error);
    }
}

invoke();
