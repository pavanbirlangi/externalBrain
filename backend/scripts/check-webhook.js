require('dotenv').config({ path: '../.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function checkWebhook() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const data = await response.json();
        console.log('Webhook Info:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkWebhook();
