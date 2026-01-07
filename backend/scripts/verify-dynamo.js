require('dotenv').config({ path: '../.env' });
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'PersonalAssistant_Tasks';

async function verifyDynamo() {
    try {
        const command = new ScanCommand({ TableName: TABLE_NAME });
        const response = await client.send(command);
        console.log('DynamoDB Items:', JSON.stringify(response.Items, null, 2));
    } catch (error) {
        console.error('Error scanning DynamoDB:', error);
    }
}

verifyDynamo();
