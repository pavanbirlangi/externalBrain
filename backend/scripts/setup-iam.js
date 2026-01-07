require('dotenv').config({ path: '../.env' });
const { IAMClient, CreateRoleCommand, PutRolePolicyCommand, GetRoleCommand } = require('@aws-sdk/client-iam');

const client = new IAMClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const ROLE_NAME = 'PersonalAssistantLambdaRole';

const TRUST_POLICY = {
    Version: '2012-10-17',
    Statement: [
        {
            Effect: 'Allow',
            Principal: {
                Service: 'lambda.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
        },
    ],
};

const PERMISSIONS_POLICY = {
    Version: '2012-10-17',
    Statement: [
        {
            Effect: 'Allow',
            Action: [
                'dynamodb:PutItem',
                'dynamodb:GetItem',
                'dynamodb:UpdateItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:DeleteItem',
            ],
            Resource: '*', // In production, restrict to specific table ARN
        },
        {
            Effect: 'Allow',
            Action: [
                'events:PutRule',
                'events:PutTargets',
                'events:DeleteRule',
                'events:RemoveTargets',
            ],
            Resource: '*',
        },
        {
            Effect: 'Allow',
            Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            Resource: '*',
        },
    ],
};

async function createRole() {
    try {
        // Check if role exists
        try {
            const getRole = new GetRoleCommand({ RoleName: ROLE_NAME });
            const { Role } = await client.send(getRole);
            console.log(`Role ${ROLE_NAME} already exists. ARN: ${Role.Arn}`);
            return Role.Arn;
        } catch (err) {
            if (err.name !== 'NoSuchEntityException') {
                throw err;
            }
        }

        // Create Role
        const createCommand = new CreateRoleCommand({
            RoleName: ROLE_NAME,
            AssumeRolePolicyDocument: JSON.stringify(TRUST_POLICY),
        });
        const { Role } = await client.send(createCommand);
        console.log(`Role ${ROLE_NAME} created.`);

        // Attach Policy
        const putPolicyCommand = new PutRolePolicyCommand({
            RoleName: ROLE_NAME,
            PolicyName: 'PersonalAssistantPolicy',
            PolicyDocument: JSON.stringify(PERMISSIONS_POLICY),
        });
        await client.send(putPolicyCommand);
        console.log('Permissions attached to role.');

        return Role.Arn;
    } catch (error) {
        console.error('Error creating role:', error);
    }
}

createRole();
