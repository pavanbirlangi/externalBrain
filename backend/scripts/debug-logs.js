require('dotenv').config({ path: '../.env' });
const { CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

const client = new CloudWatchLogsClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const LOG_GROUP_NAME = '/aws/lambda/PersonalAssistant_WebhookHandler';

async function fetchLogs() {
    try {
        const command = new FilterLogEventsCommand({
            logGroupName: LOG_GROUP_NAME,
            limit: 20,
            startTime: Date.now() - 1000 * 60 * 10, // Last 10 minutes
        });

        const response = await client.send(command);

        console.log('--- Recent Logs ---');
        if (response.events) {
            response.events.forEach(event => {
                console.log(event.message);
            });
        } else {
            console.log('No events found.');
        }
        console.log('-------------------');

    } catch (error) {
        console.error('Error fetching logs:', error);
    }
}

fetchLogs();
