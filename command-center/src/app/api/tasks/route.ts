import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const dbClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});
const docClient = DynamoDBDocumentClient.from(dbClient);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'PersonalAssistant_Tasks';
const TASK_SCHEDULER_ARN = process.env.TASK_SCHEDULER_ARN;

// Debug Log for Environment
console.log('--- API Route Init ---');
console.log('Region:', process.env.AWS_REGION);
console.log('Table:', TABLE_NAME);
console.log('Scheduler ARN:', TASK_SCHEDULER_ARN);
console.log('Access Key Present:', !!process.env.AWS_ACCESS_KEY_ID);
console.log('Secret Key Present:', !!process.env.AWS_SECRET_ACCESS_KEY);
console.log('----------------------');

// Helper to get start/end of day
function getDayRange(dateStr: string) {
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export async function GET(request: Request) {
    try {
        console.log('GET /api/tasks called');
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');
        const userId = '1069945118'; // Hardcoded for MVP

        // Query all tasks for user (Partition Key = userId)
        // Ideally we have a GSI for date, but for MVP we fetch all and filter.
        const command = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'userId = :uid',
            ExpressionAttributeValues: {
                ':uid': userId,
            },
        });

        const response = await docClient.send(command);
        const allItems = response.Items || [];

        // Separate tasks, templates, and exceptions
        const realTasks = allItems.filter((item: any) => item.type === 'task');
        const templates = allItems.filter((item: any) => item.type === 'template');
        const exceptions = allItems.filter((item: any) => item.type === 'exception');

        let displayTasks: any[] = [];

        if (dateParam) {
            const { start, end } = getDayRange(dateParam);
            const dayOfWeek = start.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dateStr = start.toISOString().split('T')[0]; // YYYY-MM-DD for exception matching

            // 1. Filter real tasks for this date
            const tasksForDate = realTasks.filter((task: any) => {
                const taskDate = new Date(task.remindAt);
                return taskDate >= start && taskDate <= end;
            });

            // 2. Generate Virtual Tasks from Templates
            const virtualTasks: any[] = [];

            templates.forEach((template: any) => {
                // Check if template recurs on this day
                if (template.recurrence && (template.recurrence.includes('DAILY') || template.recurrence.includes(dayOfWeek))) {
                    // Check for Exception
                    const isException = exceptions.some((ex: any) => ex.templateId === template.taskId && ex.date === dateStr);
                    if (isException) return;

                    // Check if a real instance already exists for this date
                    const hasInstance = tasksForDate.some((t: any) => t.fromTemplateId === template.taskId);

                    if (!hasInstance) {
                        // Create Virtual Task
                        const templateTime = new Date(template.remindAt);
                        const virtualDate = new Date(start);
                        virtualDate.setHours(templateTime.getHours(), templateTime.getMinutes(), 0, 0);

                        // Only show if it's in the future relative to the template start? 
                        // Or just always show if it matches day. 
                        // Let's assume always show for simplicity of "Calendar view".

                        virtualTasks.push({
                            ...template,
                            taskId: `virtual-${template.taskId}-${dateStr}`, // Unique ID for UI
                            remindAt: virtualDate.toISOString(),
                            status: 'pending',
                            type: 'task', // Treat as task for UI
                            isVirtual: true,
                            fromTemplateId: template.taskId, // So we know it's a template
                        });
                    }
                }
            });

            displayTasks = [...tasksForDate, ...virtualTasks];
        } else {
            // If no date, just return everything (maybe not useful for this view, but fallback)
            displayTasks = realTasks;
        }

        // Sort by time
        displayTasks.sort((a: any, b: any) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());

        // Calculate Streak (Current Streak)
        // Sort all completed tasks by date (descending)
        const allCompleted = allItems
            .filter((t: any) => t.status === 'done' && t.completedAt)
            .map((t: any) => new Date(t.completedAt).toISOString().split('T')[0]) // YYYY-MM-DD
            .sort((a: string, b: string) => b.localeCompare(a)); // Descending

        // Deduplicate days
        const activeDays = [...new Set(allCompleted)];

        let streak = 0;
        let checkDate = new Date();

        for (let i = 0; i < 365; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (activeDays.includes(dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                if (i === 0) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }

        // Calculate Heatmap Data (Date -> Count)
        const heatmap: Record<string, number> = {};
        allCompleted.forEach((date: string) => {
            heatmap[date] = (heatmap[date] || 0) + 1;
        });

        return Response.json({ tasks: displayTasks, streak, heatmap });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { title, remindAt, type, recurrence, fromTemplateId } = body;
        const userId = '1069945118';

        const payload = {
            userId,
            title,
            remindAt,
            type,
            recurrence,
            fromTemplateId, // Pass this if materializing a virtual task
        };

        const command = new InvokeCommand({
            FunctionName: 'PersonalAssistant_TaskScheduler',
            InvocationType: 'Event',
            Payload: JSON.stringify({ body: JSON.stringify(payload) }),
        });

        await lambdaClient.send(command);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error scheduling task:', error);
        return Response.json({ error: 'Failed to schedule task: ' + (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { taskId, status, title, remindAt, recurrence } = body;
        const userId = '1069945118';

        let updateExpression = 'set';
        const expressionAttributeValues: any = {};
        const expressionAttributeNames: any = {};

        if (status) {
            updateExpression += ' #s = :s,';
            expressionAttributeNames['#s'] = 'status';
            expressionAttributeValues[':s'] = status;
            if (status === 'done') {
                updateExpression += ' completedAt = :c,';
                expressionAttributeValues[':c'] = new Date().toISOString();
            }
        }

        if (title) {
            updateExpression += ' title = :t,';
            expressionAttributeValues[':t'] = title;
        }

        if (remindAt) {
            updateExpression += ' remindAt = :r,';
            expressionAttributeValues[':r'] = remindAt;
        }

        if (recurrence) {
            updateExpression += ' recurrence = :rec,';
            expressionAttributeValues[':rec'] = recurrence;
        }

        // Remove trailing comma
        updateExpression = updateExpression.slice(0, -1);

        const command = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { userId, taskId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: expressionAttributeValues,
        });

        await docClient.send(command);

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error updating task:', error);
        return Response.json({ error: 'Failed to update task' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');
        const mode = searchParams.get('mode'); // 'single' | 'series'
        const date = searchParams.get('date'); // YYYY-MM-DD
        const templateId = searchParams.get('templateId');
        const userId = '1069945118';

        if (!taskId) {
            return Response.json({ error: 'Missing taskId' }, { status: 400 });
        }

        if (mode === 'series') {
            // Delete the Template
            const targetId = templateId || taskId; // If taskId IS the templateId (rare from UI but possible)
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { userId, taskId: targetId },
            }));
        } else {
            // Single Deletion

            // 1. If it's a real task, delete it
            if (!taskId.startsWith('virtual-')) {
                await docClient.send(new DeleteCommand({
                    TableName: TABLE_NAME,
                    Key: { userId, taskId },
                }));
            }

            // 2. If it's part of a series (has templateId), create an Exception
            // This prevents the virtual task from reappearing
            if (templateId && date) {
                const exceptionItem = {
                    userId,
                    taskId: `exception-${templateId}-${date}`,
                    type: 'exception',
                    templateId,
                    date,
                    createdAt: new Date().toISOString(),
                };
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: exceptionItem,
                }));
            }
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        return Response.json({ error: 'Failed to delete task' }, { status: 500 });
    }
}
