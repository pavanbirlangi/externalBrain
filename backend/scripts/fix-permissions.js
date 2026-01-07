require('dotenv').config({ path: '../.env' });
const { LambdaClient, RemovePermissionCommand, AddPermissionCommand } = require('@aws-sdk/client-lambda');

const client = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const FUNCTION_NAME = 'PersonalAssistant_WebhookHandler';

async function fixPermissions() {
    try {
        // 1. Remove existing permission
        try {
            await client.send(new RemovePermissionCommand({
                FunctionName: FUNCTION_NAME,
                StatementId: 'FunctionURLAllowPublicAccess',
            }));
            console.log('Removed existing permission.');
        } catch (err) {
            console.log('Permission might not exist or error removing:', err.message);
        }

        // 2. Add permission again
        await client.send(new AddPermissionCommand({
            FunctionName: FUNCTION_NAME,
            StatementId: 'FunctionURLAllowPublicAccess',
            Action: 'lambda:InvokeFunctionUrl',
            Principal: '*',
            FunctionUrlAuthType: 'NONE',
        }));
        console.log('Added public access permission.');

    } catch (error) {
        console.error('Error fixing permissions:', error);
    }
}

fixPermissions();
