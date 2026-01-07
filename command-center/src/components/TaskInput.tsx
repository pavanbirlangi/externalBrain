'use client';

import { useState } from 'react';

export default function TaskInput() {
    const [title, setTitle] = useState('');
    const [remindAt, setRemindAt] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !remindAt) return;

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    remindAt: new Date(remindAt).toISOString(),
                    type: 'task',
                }),
            });

            if (res.ok) {
                alert('Task Scheduled!');
                setTitle('');
                setRemindAt('');
            } else {
                alert('Failed to schedule task.');
            }
        } catch (err) {
            console.error(err);
            alert('Error submitting task.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 border rounded-lg shadow-md max-w-md mx-auto mt-10">
            <h2 className="text-xl font-bold">Add New Task</h2>

            <div>
                <label className="block text-sm font-medium">Task Title</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 border rounded text-black"
                    placeholder="e.g., Buy Chicken"
                />
            </div>

            <div>
                <label className="block text-sm font-medium">Remind At</label>
                <input
                    type="datetime-local"
                    value={remindAt}
                    onChange={(e) => setRemindAt(e.target.value)}
                    className="w-full p-2 border rounded text-black"
                />
            </div>

            <button
                type="submit"
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
                Schedule Task
            </button>
        </form>
    );
}
