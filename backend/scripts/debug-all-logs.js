require('dotenv').config({ path: '../.env' });
const { CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

const client = new CloudWatchLogsClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function fetchLogs(groupName) {
    console.log(`\n=== Logs for ${groupName} ===`);
    try {
        const command = new FilterLogEventsCommand({
            logGroupName: `/aws/lambda/PersonalAssistant_${groupName}`,
            limit: 10,
            startTime: Date.now() - 1000 * 60 * 60, // Last 1 hour
        });

        const response = await client.send(command);

        if (response.events && response.events.length > 0) {
            response.events.forEach(event => {
                console.log(`[${new Date(event.timestamp).toISOString()}] ${event.message.trim()}`);
            });
        } else {
            console.log('No events found.');
        }

    } catch (error) {
        console.log(`Error fetching logs for ${groupName}:`, error.message);
    }
}

async function main() {
    await fetchLogs('TaskScheduler');
    await fetchLogs('NagBot');
}

main();
