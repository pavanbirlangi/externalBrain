const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

const TABLE_NAME = process.env.TABLE_NAME || 'PersonalAssistant_Tasks';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

exports.handler = async (event) => {
    console.log('Generating Weekly Report...');

    // Hardcoded for MVP, or pass via event/env
    const userId = '1069945118';

    try {
        // 1. Fetch ALL tasks for the user (needed for accurate streak calculation)
        // In a production app, we'd query by GSI or keep a separate 'UserStats' table.
        // For this personal scale, a Scan is perfectly fine.
        const command = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'userId = :u',
            ExpressionAttributeValues: {
                ':u': userId,
            },
        });

        const response = await docClient.send(command);
        const tasks = response.Items || [];

        // 2. Calculate Metrics
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;

        // Filter for last 7 days for the "Weekly" part
        const last7DaysStart = new Date(now.getTime() - 7 * oneDay);

        const lastWeekTasks = tasks.filter(t => {
            const taskDate = new Date(t.remindAt);
            return taskDate >= last7DaysStart && taskDate <= now;
        });

        const totalTasks = lastWeekTasks.length;
        const completedTasks = lastWeekTasks.filter(t => t.status === 'done').length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Calculate Streak (Current Streak)
        // Sort all completed tasks by date (descending)
        const allCompleted = tasks
            .filter(t => t.status === 'done' && t.completedAt)
            .map(t => new Date(t.completedAt).toISOString().split('T')[0]) // YYYY-MM-DD
            .sort((a, b) => b.localeCompare(a)); // Descending

        // Deduplicate days
        const activeDays = [...new Set(allCompleted)];

        let streak = 0;
        let checkDate = new Date();

        // Check if today is active (if running late in the day) or yesterday
        // If report runs Monday morning, we check starting from yesterday (Sunday)
        // But if they did a task this morning, that counts too.
        // Let's just check backwards from Today.

        for (let i = 0; i < 365; i++) { // Check up to a year back
            const dateStr = checkDate.toISOString().split('T')[0];
            if (activeDays.includes(dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                // If today isn't active yet, don't break streak if yesterday was active
                if (i === 0) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }

        // Find Top Day of the Week
        const dayCounts = {};
        lastWeekTasks.filter(t => t.status === 'done').forEach(t => {
            const day = new Date(t.remindAt).toLocaleDateString('en-US', { weekday: 'long' });
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        });

        let topDay = 'N/A';
        let maxCount = 0;
        Object.entries(dayCounts).forEach(([day, count]) => {
            if (count > maxCount) {
                maxCount = count;
                topDay = day;
            }
        });

        // 3. Generate Message
        let motivation = "Keep pushing! 🚀";
        if (completionRate >= 80) motivation = "You're on fire! 🔥 Amazing consistency!";
        else if (completionRate >= 50) motivation = "Good progress! Let's aim higher next week. 💪";
        else motivation = "Rough week? Reset and crush it this week! 🌅";

        const message = `
📊 *Weekly Insight*

🔥 *Current Streak*: ${streak} days
✅ *Completion Rate*: ${completionRate}% (${completedTasks}/${totalTasks})
🏆 *Best Day*: ${topDay}

_${motivation}_
        `.trim();

        // 4. Send Telegram Message
        await sendTelegramMessage(userId, message);

        return { statusCode: 200, body: 'Report sent' };

    } catch (error) {
        console.error('Error generating report:', error);
        return { statusCode: 500, body: error.message };
    }
};

async function sendTelegramMessage(chatId, text) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
    };

    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                if (result.ok) resolve(result);
                else reject(new Error(result.description));
            });
        });

        req.on('error', (e) => reject(e));
        req.write(JSON.stringify(body));
        req.end();
    });
}
