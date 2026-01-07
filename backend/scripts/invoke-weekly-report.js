require('dotenv').config({ path: '../.env' });
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const client = new LambdaClient({ region: process.env.AWS_REGION });

async function main() {
    try {
        const command = new InvokeCommand({
            FunctionName: 'PersonalAssistant_WeeklyReporter',
            Payload: JSON.stringify({}),
        });

        const response = await client.send(command);
        const result = JSON.parse(new TextDecoder().decode(response.Payload));
        console.log('Result:', result);
    } catch (error) {
        console.error('Error invoking lambda:', error);
    }
}

main();
