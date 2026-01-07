require('dotenv').config({ path: '../.env' });
const { EventBridgeClient, PutRuleCommand, PutTargetsCommand } = require('@aws-sdk/client-eventbridge');
const { LambdaClient, GetFunctionCommand, AddPermissionCommand } = require('@aws-sdk/client-lambda');

const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

const RULE_NAME = 'PersonalAssistant-WeeklyReport-Rule';
const FUNCTION_NAME = 'PersonalAssistant_WeeklyReporter';

async function main() {
    try {
        // 1. Get Lambda ARN
        const { Configuration } = await lambdaClient.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
        const lambdaArn = Configuration.FunctionArn;
        console.log('Lambda ARN:', lambdaArn);

        // 2. Create Rule (Every Monday at 9:00 AM UTC)
        // Cron: Minutes Hours DayOfMonth Month DayOfWeek Year
        // 9:00 AM UTC is 2:30 PM IST. 
        // User is in IST (+5:30). 
        // If user wants 9:00 AM IST, that is 3:30 AM UTC.
        // Cron: 30 3 ? * MON *

        await ebClient.send(new PutRuleCommand({
            Name: RULE_NAME,
            ScheduleExpression: 'cron(30 3 ? * MON *)', // 9:00 AM IST
            State: 'ENABLED',
            Description: 'Triggers Weekly Report every Monday at 9 AM IST',
        }));
        console.log('EventBridge Rule created:', RULE_NAME);

        // 3. Add Target
        await ebClient.send(new PutTargetsCommand({
            Rule: RULE_NAME,
            Targets: [{
                Id: 'WeeklyReporterTarget',
                Arn: lambdaArn,
            }],
        }));
        console.log('Target added to rule.');

        // 4. Add Permission for EventBridge to invoke Lambda
        try {
            await lambdaClient.send(new AddPermissionCommand({
                FunctionName: FUNCTION_NAME,
                StatementId: 'WeeklyReportEventBridgeInvoke',
                Action: 'lambda:InvokeFunction',
                Principal: 'events.amazonaws.com',
                SourceArn: `arn:aws:events:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID || '518029233911'}:rule/${RULE_NAME}`,
            }));
            console.log('Lambda permission added.');
        } catch (err) {
            if (err.name === 'ResourceConflictException') {
                console.log('Lambda permission already exists.');
            } else {
                throw err;
            }
        }

    } catch (error) {
        console.error('Error scheduling report:', error);
    }
}

main();
