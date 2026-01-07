require('dotenv').config({ path: '../.env' });
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'PersonalAssistant_Tasks';

async function createTable() {
    try {
        // Check if table exists
        const listCommand = new ListTablesCommand({});
        const { TableNames } = await client.send(listCommand);

        if (TableNames.includes(TABLE_NAME)) {
            console.log(`Table ${TABLE_NAME} already exists.`);
            return;
        }

        const command = new CreateTableCommand({
            TableName: TABLE_NAME,
            KeySchema: [
                { AttributeName: 'userId', KeyType: 'HASH' },  // Partition key
                { AttributeName: 'taskId', KeyType: 'RANGE' }, // Sort key
            ],
            AttributeDefinitions: [
                { AttributeName: 'userId', AttributeType: 'S' },
                { AttributeName: 'taskId', AttributeType: 'S' },
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5,
            },
        });

        const response = await client.send(command);
        console.log(`Table ${TABLE_NAME} created successfully.`);
        console.log('Table ARN:', response.TableDescription.TableArn);
    } catch (error) {
        console.error('Error creating table:', error);
    }
}

createTable();
