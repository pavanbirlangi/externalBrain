```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { TelegramClient } = require('telegram'); // hypothetical, actually using fetch
const https = require('https');
const { EventBridgeClient, PutRuleCommand, PutTargetsCommand } = require('@aws-sdk/client-eventbridge');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

const ebClient = new EventBridgeClient({});
const NAG_BOT_ARN = process.env.NAG_BOT_ARN || process.env.AWS_LAMBDA_FUNCTION_NAME; // Self ARN if not provided, but usually passed via env or context.
// Actually, for PutTargets we need the ARN.
// In Lambda context, context.invokedFunctionArn gives the ARN of *this* function (NagBot).

const TABLE_NAME = process.env.TABLE_NAME || 'PersonalAssistant_Tasks';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

exports.handler = async (event, context) => { // Added context parameter
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        // EventBridge passes the target input as the event
        const { userId, taskId, title, type, isChase } = event;

        if (!userId || !taskId) {
            console.error('Missing userId or taskId');
            return;
        }

        // Send Telegram Message
        // We need the user's Telegram Chat ID.
        // For MVP, assuming userId IS the chat_id or we store the mapping.
        // Let's assume userId = chat_id for simplicity in this "Personal" assistant.
        const chatId = userId;

        let message = `Time for ${ title }! ⏰`;
        if (isChase) {
            message = `🚨 * URGENT *: You haven't done this yet!\n\n*${title}*\n\nDo it NOW!`;

// Recursive Scheduling: Schedule NEXT chase in 10 minutes
// This creates the infinite loop until user acts (which deletes the rule)
const nextChaseDate = new Date(Date.now() + 10 * 60000); // 10 minutes from now
const cron = `cron(${nextChaseDate.getMinutes()} ${nextChaseDate.getHours()} ${nextChaseDate.getDate()} ${nextChaseDate.getMonth() + 1} ? ${nextChaseDate.getFullYear()})`;
const ruleName = `Task-${userId}-${taskId}-Chase`;

console.log(`Scheduling next chase for ${nextChaseDate.toISOString()} (Rule: ${ruleName})`);

await ebClient.send(new PutRuleCommand({
    Name: ruleName,
    ScheduleExpression: cron,
    State: 'ENABLED',
}));

// We need to add the target again because PutRule might reset it?
// Actually PutRule just updates the schedule. The target *should* persist if we don't touch it.
// BUT, if the rule was deleted (it shouldn't be if we are here), or if we want to be safe.
// Best practice: PutTargets again to be sure.
// We need our own ARN.
const myArn = context.invokedFunctionArn;

await ebClient.send(new PutTargetsCommand({
    Rule: ruleName,
    Targets: [
        {
            Id: 'NagBotTarget',
            Arn: myArn,
            Input: JSON.stringify({ userId, taskId, title, type, isChase: true }),
        },
    ],
}));
        }
const keyboard = {
    inline_keyboard: [
        [
            { text: 'Done ✅', callback_data: `DONE:${taskId}` },
            { text: 'Snooze 1hr 💤', callback_data: `SNOOZE:${taskId}:60` },
        ],
        [
            { text: 'Skip ⏭️', callback_data: `SKIP:${taskId}` },
        ]
    ]
};

await sendTelegramMessage(chatId, message, keyboard);

// Update Task Status to 'nagging' (optional, or just keep pending)
// We might want to track that we sent the alert.

return { statusCode: 200, body: 'Nag sent' };
    } catch (error) {
    console.error('Error:', error);
    throw error; // Retry logic
}
};

async function sendTelegramMessage(chatId, text, replyMarkup) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = {
        chat_id: chatId,
        text: text,
        reply_markup: replyMarkup,
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!data.ok) {
        throw new Error(`Telegram API Error: ${data.description}`);
    }
}
