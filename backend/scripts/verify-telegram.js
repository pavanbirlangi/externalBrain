require('dotenv').config({ path: '../.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN is missing in .env');
    process.exit(1);
}

async function verifyBot() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const data = await response.json();

        if (data.ok) {
            console.log('Telegram Bot Verified!');
            console.log('Bot Name:', data.result.first_name);
            console.log('Bot Username:', data.result.username);
        } else {
            console.error('Telegram Bot Verification Failed:', data.description);
        }
    } catch (error) {
        console.error('Error verifying bot:', error);
    }
}

verifyBot();
