require('dotenv').config({ path: '../.env' });
const { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, GetFunctionCommand } = require('@aws-sdk/client-lambda');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const client = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const ROLE_ARN = process.env.LAMBDA_ROLE_ARN;
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'PersonalAssistant_Tasks';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function deployLambda(name, fileName, envVars = {}) {
    console.log(`Deploying ${name}...`);

    const zip = new AdmZip();
    zip.addLocalFile(path.join(__dirname, '../lambdas', fileName));
    const zipBuffer = zip.toBuffer();

    const functionName = `PersonalAssistant_${name}`;

    // This block seems to be an attempt to dynamically determine the handler file name
    // based on the function name for specific lambdas.
    // However, the `fileName` parameter already provides the correct file name.
    // The `else if` part is also misplaced and duplicates existing logic.
    // I will integrate the `if` condition for `NagBot` and `DailyPlanner`
    // by ensuring the `handler` variable is correctly set if this logic is intended
    // to override the default `fileName.split('.')[0]`.
    // Given the existing structure, the `fileName` parameter already dictates the handler.
    // I will assume the user wants to add a specific handler override for these two
    // if the `fileName` passed is not the standard one.
    // For now, I'll place the `if` block as requested, but it might need further refinement
    // if the intent is different from what the snippet suggests.
    let handlerFileName = fileName.split('.')[0];
    // let handlerFileName = fileName.split('.')[0]; // Removed duplicate
    if (functionName === 'PersonalAssistant_NagBot' || functionName === 'PersonalAssistant_DailyPlanner') {
        let derivedFileName = functionName.replace('PersonalAssistant_', '');
        derivedFileName = derivedFileName.charAt(0).toLowerCase() + derivedFileName.slice(1);
        handlerFileName = derivedFileName;
    }
    // The `else if` block for 'PersonalAssistant_TaskScheduler' in the snippet
    // contains code that is already part of the main try/catch logic for updating functions.
    // It's syntactically incorrect to place it here and would lead to duplicate execution.
    // I will omit the `else if` part as it's a malformed snippet.

    try {
        // Check if exists
        try {
            await client.send(new GetFunctionCommand({ FunctionName: functionName }));

            // Update Code
            await client.send(new UpdateFunctionCodeCommand({
                FunctionName: functionName,
                ZipFile: zipBuffer,
            }));

            // Update Config (Env Vars)
            await client.send(new UpdateFunctionConfigurationCommand({
                FunctionName: functionName,
                Environment: { Variables: envVars },
            }));

            console.log(`Updated ${name}`);
        } catch (err) {
            if (err.name === 'ResourceNotFoundException') {
                // Create
                await client.send(new CreateFunctionCommand({
                    FunctionName: functionName,
                    Runtime: 'nodejs20.x',
                    Role: ROLE_ARN,
                    Handler: `${handlerFileName}.handler`, // Use the potentially modified handlerFileName
                    Code: { ZipFile: zipBuffer },
                    Environment: { Variables: envVars },
                    Timeout: 15,
                }));
                console.log(`Created ${name}`);
            } else {
                throw err;
            }
        }

        // Get ARN
        const { Configuration } = await client.send(new GetFunctionCommand({ FunctionName: functionName }));
        return Configuration.FunctionArn;

    } catch (error) {
        console.error(`Error deploying ${name}:`, error);
        throw error;
    }
}

async function main() {
    try {
        // 1. Deploy NagBot (No dependencies on other Lambdas)
        // const nagBotArn = await deployLambda('NagBot', 'nagBot.js', {
        //     TABLE_NAME,
        //     TELEGRAM_BOT_TOKEN: BOT_TOKEN,
        // });
        // console.log('NagBot ARN:', nagBotArn);
        const nagBotArn = 'arn:aws:lambda:ap-south-1:518029233911:function:PersonalAssistant_NagBot'; // Hardcoded for now

        // 2. Deploy TaskScheduler (Needs NagBot ARN)
        // const schedulerArn = await deployLambda('TaskScheduler', 'taskScheduler.js', {
        //     TABLE_NAME,
        //     NAG_BOT_ARN: nagBotArn,
        // });
        // console.log('TaskScheduler ARN:', schedulerArn);

        // 3. Deploy DailyPlanner (No dependencies on other Lambdas, but might need NagBot ARN for future integration)
        // const dailyPlannerArn = await deployLambda('DailyPlanner', 'dailyPlanner.js', {
        //     TABLE_NAME,
        //     TELEGRAM_BOT_TOKEN: BOT_TOKEN,
        //     NAG_BOT_ARN: nagBotArn, // Assuming it might need NagBot for notifications
        // });
        // console.log('DailyPlanner ARN:', dailyPlannerArn);

        // 4. Deploy WebhookHandler (Needs NagBot ARN)
        const webhookArn = await deployLambda('WebhookHandler', 'webhookHandler.js', {
            TABLE_NAME,
            TELEGRAM_BOT_TOKEN: BOT_TOKEN,
            NAG_BOT_ARN: nagBotArn,
        });
        console.log('WebhookHandler ARN:', webhookArn);
        // 5. Deploy WeeklyReporter
        // const reporterArn = await deployLambda('WeeklyReporter', 'weeklyReporter.js', {
        //     TABLE_NAME,
        //     TELEGRAM_BOT_TOKEN: BOT_TOKEN,
        // });
        // console.log('WeeklyReporter ARN:', reporterArn);

    } catch (error) {
        console.error('Deployment failed:', error);
    }
}

main();
