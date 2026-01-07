const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutRuleCommand, PutTargetsCommand, DeleteRuleCommand, RemoveTargetsCommand } = require('@aws-sdk/client-eventbridge');

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const ebClient = new EventBridgeClient({});

const TABLE_NAME = process.env.TABLE_NAME || 'PersonalAssistant_Tasks';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NAG_BOT_ARN = process.env.NAG_BOT_ARN;

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        const body = JSON.parse(event.body);

        if (body.callback_query) {
            await handleCallbackQuery(body.callback_query);
        } else if (body.message) {
            // Handle text messages (e.g. /start or quick log)
            // For now, just echo or ignore
        }

        return { statusCode: 200, body: 'OK' };
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: error.message };
    }
};

async function handleCallbackQuery(query) {
    const { data, message, from } = query;
    const chatId = message.chat.id;
    const messageId = message.message_id;

    const [action, taskId, param] = data.split(':');
    // userId is from.id (should match chatId in DM)
    const userId = String(from.id);

    if (action === 'DONE') {
        // 1. Update DynamoDB
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { userId, taskId },
            UpdateExpression: 'set #s = :s, completedAt = :c',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':s': 'done', ':c': new Date().toISOString() },
        }));

        // 2. Edit Message to remove buttons and show success
        await editMessageText(chatId, messageId, `✅ Completed: ${message.text.split('!')[0]}!`);
        await answerCallbackQuery(query.id, 'Great job! 🔥');

        // 3. Cancel Chase Event
        const chaseRuleName = `Task-${userId}-${taskId}-Chase`;
        try {
            await ebClient.send(new RemoveTargetsCommand({
                Rule: chaseRuleName,
                Ids: ['NagBotTarget'],
            }));
            await ebClient.send(new DeleteRuleCommand({
                Name: chaseRuleName,
            }));
            console.log('Chase rule deleted:', chaseRuleName);
        } catch (err) {
            console.log('Error deleting chase rule (might not exist):', err.message);
        }

    } else if (action === 'SNOOZE') {
        const minutes = parseInt(param);

        // 1. Calculate new time
        const remindAt = new Date(Date.now() + minutes * 60000);

        // 2. Update DynamoDB
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { userId, taskId },
            UpdateExpression: 'set remindAt = :r, snoozeCount = if_not_exists(snoozeCount, :z) + :inc',
            ExpressionAttributeValues: {
                ':r': remindAt.toISOString(),
                ':z': 0,
                ':inc': 1
            },
        }));

        // 3. Schedule new EventBridge Rule (or update existing)
        // Re-using logic from TaskScheduler would be ideal, but for now duplicate simple logic
        const cron = `cron(${remindAt.getMinutes()} ${remindAt.getHours()} ${remindAt.getDate()} ${remindAt.getMonth() + 1} ? ${remindAt.getFullYear()})`;
        const ruleName = `Task-${userId}-${taskId}-Snooze`; // Unique name for snooze? Or overwrite old one?
        // If we overwrite `Task-${userId}-${taskId}`, we need to know the old rule name.
        // Let's assume we overwrite or create new.

        await ebClient.send(new PutRuleCommand({
            Name: ruleName,
            ScheduleExpression: cron,
            State: 'ENABLED',
        }));

        await ebClient.send(new PutTargetsCommand({
            Rule: ruleName,
            Targets: [{
                Id: 'NagBotTarget',
                Arn: NAG_BOT_ARN,
                Input: JSON.stringify({ userId, taskId, title: 'Snoozed Task', type: 'task', isChase: false }),
            }],
        }));

        // 3b. Schedule "Chase" Event (10 mins after snooze)
        const chaseDate = new Date(remindAt.getTime() + 10 * 60000);
        const chaseCron = `cron(${chaseDate.getMinutes()} ${chaseDate.getHours()} ${chaseDate.getDate()} ${chaseDate.getMonth() + 1} ? ${chaseDate.getFullYear()})`;
        const newChaseRuleName = `Task-${userId}-${taskId}-Chase`; // Renamed to avoid conflict

        await ebClient.send(new PutRuleCommand({
            Name: newChaseRuleName,
            ScheduleExpression: chaseCron,
            State: 'ENABLED',
        }));

        await ebClient.send(new PutTargetsCommand({
            Rule: newChaseRuleName,
            Targets: [
                {
                    Id: 'NagBotTarget',
                    Arn: NAG_BOT_ARN,
                    Input: JSON.stringify({ userId, taskId, title: 'Snoozed Task', type: 'task', isChase: true }),
                },
            ],
        }));

        await editMessageText(chatId, messageId, `💤 Snoozed for ${minutes}m.`);
        await answerCallbackQuery(query.id, 'Snoozed.');

        // 4. (Removed) Do NOT cancel the chase event here, because we just rescheduled it above!
        // The PutRule above overwrote the old chase rule with the new time.
        // If we delete it now, we lose the chase.

    } else if (action === 'SKIP') {
        // 1. Calculate new time (Tomorrow same time)
        const remindAt = new Date(Date.now() + 24 * 60 * 60000);

        // 2. Update DynamoDB
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { userId, taskId },
            UpdateExpression: 'set remindAt = :r, snoozeCount = if_not_exists(snoozeCount, :z) + :inc',
            ExpressionAttributeValues: {
                ':r': remindAt.toISOString(),
                ':z': 0,
                ':inc': 1
            },
        }));

        // 3. Schedule new EventBridge Rule
        const cron = `cron(${remindAt.getMinutes()} ${remindAt.getHours()} ${remindAt.getDate()} ${remindAt.getMonth() + 1} ? ${remindAt.getFullYear()})`;
        const ruleName = `Task-${userId}-${taskId}-Skip`;

        await ebClient.send(new PutRuleCommand({
            Name: ruleName,
            ScheduleExpression: cron,
            State: 'ENABLED',
        }));

        await ebClient.send(new PutTargetsCommand({
            Rule: ruleName,
            Targets: [{
                Id: 'NagBotTarget',
                Arn: NAG_BOT_ARN,
                Input: JSON.stringify({ userId, taskId, title: 'Skipped Task', type: 'task' }),
            }],
        }));

        // 3b. Schedule "Chase" Event (10 mins after new time)
        const chaseDate = new Date(remindAt.getTime() + 10 * 60000);
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
                    Input: JSON.stringify({ userId, taskId, title: 'Skipped Task', type: 'task', isChase: true }),
                },
            ],
        }));

        await editMessageText(chatId, messageId, `⏭️ Skipped to tomorrow.`);
        await answerCallbackQuery(query.id, 'Skipped.');

        // 4. (Removed) Do NOT cancel the chase event here, because we just rescheduled it above!
    }
}

async function editMessageText(chatId, messageId, text) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
    });
}

async function answerCallbackQuery(callbackQueryId, text) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
}
