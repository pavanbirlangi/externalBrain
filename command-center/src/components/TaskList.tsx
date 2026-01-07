'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import TaskCard from './TaskCard';

interface Task {
    taskId: string;
    title: string;
    status: string;
    remindAt: string;
    type: string;
}

interface TaskListProps {
    tasks: Task[];
    loading: boolean;
    onToggle: (taskId: string, status: string) => void;
    onDelete: (taskId: string, mode?: 'single' | 'series', date?: string, templateId?: string) => void;
    onUpdate: (taskId: string, title: string, isVirtual?: boolean, fromTemplateId?: string, remindAt?: string) => void;
}

export default function TaskList({ tasks, loading, onToggle, onDelete, onUpdate }: TaskListProps) {
    if (loading) {
        return (
            <div className="flex flex-col space-y-3 mt-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-neutral-900/50 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-600">
                <p className="text-sm">No tasks for this day.</p>
                <p className="text-xs mt-1">Enjoy the silence.</p>
            </div>
        );
    }

    return (
        <div className="mt-4 pb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode='popLayout'>
                {tasks.map((task) => (
                    <TaskCard
                        key={task.taskId}
                        task={task}
                        onToggle={onToggle}
                        onDelete={onDelete}
                        onUpdate={onUpdate}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}
