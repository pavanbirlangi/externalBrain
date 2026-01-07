require('dotenv').config({ path: '../.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function getChatId() {
    try {
        // 1. Delete Webhook
        console.log('Deleting Webhook...');
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);

        // 2. Get Updates
        console.log('Fetching Updates...');
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
        const data = await response.json();

        if (data.ok) {
            console.log('Updates:', JSON.stringify(data.result, null, 2));

            const message = data.result.find(u => u.message && u.message.text);
            if (message) {
                console.log('FOUND CHAT ID:', message.message.chat.id);
            } else {
                console.log('No messages found. Please send "Hello" to the bot again.');
            }
        } else {
            console.error('Error getting updates:', data.description);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

getChatId();
