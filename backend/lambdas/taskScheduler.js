const { EventBridgeClient, PutRuleCommand, PutTargetsCommand } = require('@aws-sdk/client-eventbridge');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ebClient = new EventBridgeClient({});
const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

const TABLE_NAME = process.env.TABLE_NAME || 'PersonalAssistant_Tasks';
const NAG_BOT_ARN = process.env.NAG_BOT_ARN; // ARN of the NagBot Lambda

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        const { userId, title, remindAt, type, recurrence, fromTemplateId } = JSON.parse(event.body);
        const taskId = `${Date.now()}`;

        // 1. Save to DynamoDB
        const item = {
            userId,
            taskId,
            title,
            remindAt,
            type: recurrence ? 'template' : 'task', // If recurrence exists, it's a template
            status: 'pending',
            snoozeCount: 0,
            createdAt: new Date().toISOString(),
            recurrence: recurrence || undefined,
            fromTemplateId: fromTemplateId || undefined,
        };

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: item,
        }));

        // 2. Schedule EventBridge Rule
        // Convert remindAt (ISO string) to Cron expression or specific time
        // For simplicity, assuming remindAt is ISO string. EventBridge Schedule API is better for one-offs, 
        // but here we use Rules as per plan (or Schedule API if available in SDK v3 easily).
        // Actually, EventBridge Scheduler is the modern way for one-off schedules.
        // Let's use EventBridge Scheduler if possible, or standard Rules with cron.
        // "One-Time" Schedule for reminder time.

        // NOTE: For this MVP, we might use a simple Rule that triggers at a specific time?
        // Rules are not great for one-off precision. EventBridge Scheduler is better.
        // But for "The Alarm Clock" description: "EventBridge wakes up the Lambda".

        // Let's stick to the plan: "EventBridge 'One-Time' Schedule".
        // We will use the `scheduler` client if available, or just standard PutRule with a cron for that specific minute.
        // Note: Standard rules have a limit. Scheduler is scalable.
        // I'll use standard PutRule for now as it's in the `client-eventbridge` package I installed.
        // Cron: min hr day month ? year

        // Only schedule EventBridge if it's a one-off task (not a template)
        // OR if it's a template but we also want to run it TODAY (optional, but let's keep it simple: templates don't schedule immediately unless DailyPlanner runs)
        // Actually, if user creates a "Daily" task at 10AM for 11AM, they expect it today.
        // So if it's a template, we should ALSO check if it should run today and schedule it?
        // For simplicity, let's say:
        // - If type='task', schedule it.
        // - If type='template', just save it. (DailyPlanner will pick it up tomorrow, or we can trigger it manually for today).

        // Let's stick to: If it's a template, we DO NOT schedule the specific rule for *this* item (because this item is the template).
        // We should probably create a separate 'task' item for today if needed.
        // But to avoid complexity, let's just say templates start "tomorrow" or next run.

        if (item.type === 'task') {
            await scheduleTask(item, userId, taskId, title, remindAt);
        } else if (item.type === 'template') {
            // Check if the template should run on the start date (remindAt)
            const date = new Date(remindAt);
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(); // MON, TUE...

            // Note: recurrence is an array like ['MON', 'WED']
            if (recurrence && (recurrence.includes('DAILY') || recurrence.includes(dayOfWeek))) {
                console.log(`Template matches start date (${dayOfWeek}). Creating immediate task instance.`);

                // Create a separate task instance
                const instanceId = `${Date.now()}-instance`;
                const instanceItem = {
                    userId,
                    taskId: instanceId,
                    title,
                    remindAt,
                    type: 'task',
                    status: 'pending',
                    snoozeCount: 0,
                    createdAt: new Date().toISOString(),
                    fromTemplateId: taskId,
                };

                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: instanceItem,
                }));

                await scheduleTask(instanceItem, userId, instanceId, title, remindAt);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Task scheduled', taskId }),
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

async function scheduleTask(item, userId, taskId, title, remindAt) {
    const date = new Date(remindAt);
    const cron = `cron(${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} ? ${date.getFullYear()})`;
    const ruleName = `Task-${userId}-${taskId}`;

    await ebClient.send(new PutRuleCommand({
        Name: ruleName,
        ScheduleExpression: cron,
        State: 'ENABLED',
    }));

    await ebClient.send(new PutTargetsCommand({
        Rule: ruleName,
        Targets: [
            {
                Id: 'NagBotTarget',
                Arn: NAG_BOT_ARN,
                Input: JSON.stringify({ userId, taskId, title, type: 'task', isChase: false }),
            },
        ],
    }));

    // Schedule "Chase" Event (10 mins later)
    const chaseDate = new Date(date.getTime() + 10 * 60000);
    const chaseCron = `cron(${chaseDate.getMinutes()} ${chaseDate.getHours()} ${chaseDate.getDate()} ${chaseDate.getMonth() + 1} ? ${chaseDate.getFullYear()})`;
    const chaseRuleName = `Task-${userId}-${taskId}-Chase`;

    await ebClient.send(new PutRuleCommand({
        Name: chaseRuleName,
        ScheduleExpression: chaseCron,
        State: 'ENABLED',
    }));

    await ebClient.send(new PutTargetsCommand({
        Rule: chaseRuleName,
        Targets: [
            {
                Id: 'NagBotTarget',
                Arn: NAG_BOT_ARN,
                Input: JSON.stringify({ userId, taskId, title, type: 'task', isChase: true }),
            },
        ],
    }));
}
