const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutRuleCommand, PutTargetsCommand } = require('@aws-sdk/client-eventbridge');

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const ebClient = new EventBridgeClient({});

const TABLE_NAME = process.env.TABLE_NAME || 'PersonalAssistant_Tasks';
const NAG_BOT_ARN = process.env.NAG_BOT_ARN;

exports.handler = async (event) => {
    console.log('DailyPlanner started:', new Date().toISOString());

    try {
        // 1. Scan for all templates
        // In a real app, Query by GSI (type = 'template') would be better.
        // For MVP, Scan is fine.
        const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: '#t = :template',
            ExpressionAttributeNames: { '#t': 'type' },
            ExpressionAttributeValues: { ':template': 'template' },
        });

        const response = await docClient.send(scanCommand);
        const templates = response.Items || [];
        console.log(`Found ${templates.length} templates.`);

        const today = new Date();
        const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(); // MON, TUE...
        // Note: AWS Lambda might be in UTC. We should adjust for user timezone if possible.
        // For MVP, let's assume UTC or fixed offset. 
        // Better: Store user timezone in DB.
        // For now, let's just use the server time (UTC) or maybe add 5.5h for IST if hardcoded for this user?
        // Let's stick to UTC for simplicity, or maybe the user provides "Daily" which is timezone agnostic relative to "00:00".

        // Actually, if this runs at 00:00 UTC, it's 5:30 AM IST.
        // If the user wants tasks for "Today", we generate them now.

        for (const template of templates) {
            if (shouldRunToday(template.recurrence, dayOfWeek)) {
                await createTaskFromTemplate(template, today);
            }
        }

        return { statusCode: 200, body: 'Daily planning complete' };
    } catch (error) {
        console.error('Error in DailyPlanner:', error);
        return { statusCode: 500, body: error.message };
    }
};

function shouldRunToday(recurrence, dayOfWeek) {
    if (!recurrence) return false;
    if (Array.isArray(recurrence)) {
        return recurrence.includes('DAILY') || recurrence.includes(dayOfWeek);
    }
    return false;
}

async function createTaskFromTemplate(template, dateObj) {
    const { userId, title, remindAt } = template;
    const taskId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Calculate remindAt for today
    // template.remindAt is likely an ISO string or just time "HH:mm".
    // If it's a full ISO from the past, we extract the time.
    const templateDate = new Date(remindAt);
    const newRemindAt = new Date(dateObj);
    newRemindAt.setHours(templateDate.getHours(), templateDate.getMinutes(), 0, 0);

    // If the time has already passed for today (e.g. it's 10 AM and task was 8 AM), 
    // maybe we still create it as "pending"? Yes.

    const item = {
        userId,
        taskId,
        title,
        remindAt: newRemindAt.toISOString(),
        type: 'task',
        status: 'pending',
        snoozeCount: 0,
        createdAt: new Date().toISOString(),
        fromTemplateId: template.taskId,
    };

    // 1. Save to DynamoDB
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
    }));
    console.log(`Created task ${taskId} from template ${template.taskId}`);

    // 2. Schedule EventBridge Rule
    const cron = `cron(${newRemindAt.getMinutes()} ${newRemindAt.getHours()} ${newRemindAt.getDate()} ${newRemindAt.getMonth() + 1} ? ${newRemindAt.getFullYear()})`;
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

    // Schedule Chase (15 mins later)
    const chaseDate = new Date(newRemindAt.getTime() + 15 * 60000);
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
