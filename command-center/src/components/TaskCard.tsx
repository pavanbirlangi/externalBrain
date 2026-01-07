'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, Trash2, X, Repeat, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import DeleteModal from './DeleteModal';

interface Task {
    taskId: string;
    title: string;
    status: string;
    remindAt: string;
    type: string;
    isVirtual?: boolean;
    recurrence?: string; // Assuming recurrence might be added based on delete logic
}

interface TaskCardProps {
    task: Task;
    onToggle: (taskId: string, status: string) => void;
    onDelete: (taskId: string, mode?: 'single' | 'series', date?: string, templateId?: string) => void;
    onUpdate: (taskId: string, title: string, isVirtual?: boolean, fromTemplateId?: string, remindAt?: string) => void;
}

export default function TaskCard({ task, onToggle, onDelete, onUpdate }: TaskCardProps) {
    const isDone = task.status === 'done';
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.title);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleBlur = () => {
        setIsEditing(false);
        if (editedTitle.trim() !== task.title) {
            onUpdate(task.taskId, editedTitle, task.isVirtual, (task as any).fromTemplateId, task.remindAt);
        }
    };

    const handleDeleteClick = () => {
        if (task.recurrence || (task as any).fromTemplateId) {
            setShowDeleteModal(true);
        } else {
            onDelete(task.taskId, 'single');
        }
    };

    const handleConfirmDelete = (mode: 'single' | 'series') => {
        setShowDeleteModal(false);
        // Pass necessary info for deletion
        // If virtual, we need date and templateId
        const date = task.remindAt.split('T')[0];
        const templateId = (task as any).fromTemplateId || (task.type === 'template' ? task.taskId : undefined);

        onDelete(task.taskId, mode, date, templateId);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={clsx(
                "group relative flex items-center p-4 mb-3 rounded-2xl border backdrop-blur-md transition-all duration-300",
                isDone
                    ? "bg-green-500/5 border-green-500/20"
                    : task.isVirtual
                        ? "bg-purple-900/20 border-purple-500/30 border-dashed"
                        : "bg-neutral-900/60 border-white/5 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(0,243,255,0.1)]"
            )}
        >
            {/* Checkbox */}
            <button
                onClick={() => onToggle(task.taskId, isDone ? 'pending' : 'done')}
                className={clsx(
                    "flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-300 mr-4",
                    isDone
                        ? "bg-green-500 border-green-500 shadow-[0_0_10px_rgba(0,255,157,0.4)]"
                        : "border-neutral-600 group-hover:border-cyan-400"
                )}
            >
                {isDone && <Check size={14} className="text-black stroke-[3]" />}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <input
                        autoFocus
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
                        className="w-full bg-transparent text-white outline-none border-b border-cyan-500/50 pb-1"
                    />
                ) : (
                    <h3
                        onClick={() => setIsEditing(true)}
                        className={clsx(
                            "text-base font-medium truncate transition-all duration-300 cursor-text",
                            isDone ? "text-neutral-500 line-through decoration-neutral-600" : "text-white"
                        )}
                    >
                        {task.title}
                    </h3>
                )}
                <div className="flex items-center mt-1 space-x-2">
                    <span className={clsx(
                        "flex items-center text-xs px-2 py-0.5 rounded-full",
                        isDone ? "bg-neutral-800 text-neutral-500" : "bg-cyan-500/10 text-cyan-400"
                    )}>
                        <Clock size={10} className="mr-1" />
                        {format(new Date(task.remindAt), 'h:mm a')}
                    </span>
                    {/* Recurrence Indicator (if we had it in Task interface, which we don't yet fully but API supports it) */}
                </div>
            </div>

            {/* Delete Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick();
                }}
                className="opacity-0 group-hover:opacity-100 p-2 text-neutral-500 hover:text-red-400 transition-all duration-300"
            >
                <Trash2 size={18} />
            </button>

            <DeleteModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                isRecurring={!!(task.recurrence || (task as any).fromTemplateId)}
            />
        </motion.div>
    );
}

