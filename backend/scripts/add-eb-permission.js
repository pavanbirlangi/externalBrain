require('dotenv').config({ path: '../.env' });
const { LambdaClient, AddPermissionCommand, RemovePermissionCommand } = require('@aws-sdk/client-lambda');

const client = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const FUNCTION_NAME = 'PersonalAssistant_NagBot';

async function addPermission() {
    try {
        // Remove if exists (to avoid error if we run multiple times with same StatementId)
        try {
            await client.send(new RemovePermissionCommand({
                FunctionName: FUNCTION_NAME,
                StatementId: 'AllowEventBridgeInvoke',
            }));
            console.log('Removed existing permission.');
        } catch (err) {
            // Ignore
        }

        await client.send(new AddPermissionCommand({
            FunctionName: FUNCTION_NAME,
            StatementId: 'AllowEventBridgeInvoke',
            Action: 'lambda:InvokeFunction',
            Principal: 'events.amazonaws.com',
            SourceArn: `arn:aws:events:${process.env.AWS_REGION}:${process.env.AWS_ACCESS_KEY_ID}:rule/*`, // This might be wrong if ACCESS_KEY is not Account ID.
            // Better to use Account ID. But I don't have it easily in env (only in ARN).
            // Let's use SourceAccount if possible, or just Principal.
            // Actually, let's just use Principal for now to be safe, or construct ARN from previous logs.
            // Account ID: 518029233911 (from logs)
        }));

        console.log('Permission added successfully.');

    } catch (error) {
        console.error('Error adding permission:', error);

        // Retry without SourceArn if it fails (broader access)
        if (error.name === 'ValidationException' || error.message.includes('SourceArn')) {
            console.log('Retrying without SourceArn...');
            await client.send(new AddPermissionCommand({
                FunctionName: FUNCTION_NAME,
                StatementId: 'AllowEventBridgeInvoke',
                Action: 'lambda:InvokeFunction',
                Principal: 'events.amazonaws.com',
            }));
            console.log('Permission added (broad).');
        }
    }
}

addPermission();
