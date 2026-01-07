'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Send, X } from 'lucide-react';

interface FloatingInputProps {
    onAddTask: (title: string, time: string, recurrence?: string[]) => void;
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function FloatingInput({ onAddTask }: FloatingInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [selectedDays, setSelectedDays] = useState<string[]>([]);

    const toggleDay = (day: string) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title && time) {
            onAddTask(title, time, isRecurring ? selectedDays : undefined);
            setTitle('');
            setTime('');
            setIsRecurring(false);
            setSelectedDays([]);
            setIsOpen(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setIsOpen(false)}
                    />
                )}
            </AnimatePresence>

            <div className="fixed bottom-6 left-0 right-0 px-4 z-50 flex justify-center max-w-md mx-auto">
                <AnimatePresence mode="wait">
                    {!isOpen ? (
                        <motion.button
                            key="fab"
                            layoutId="input-container"
                            onClick={() => setIsOpen(true)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center justify-center w-14 h-14 bg-cyan-500 rounded-full shadow-[0_0_20px_rgba(0,243,255,0.4)] text-black"
                        >
                            <Plus size={28} strokeWidth={2.5} />
                        </motion.button>
                    ) : (
                        <motion.form
                            key="form"
                            layoutId="input-container"
                            onSubmit={handleSubmit}
                            className="w-full bg-[#111] border border-white/10 rounded-3xl p-2 shadow-2xl overflow-hidden"
                        >
                            <div className="flex flex-col space-y-2 p-2">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="What needs to be done?"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-transparent text-white placeholder-neutral-500 outline-none text-lg px-2"
                                />
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="time"
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        className="bg-neutral-900 text-white text-sm rounded-lg px-3 py-1.5 outline-none border border-white/5 focus:border-cyan-500/50"
                                    />
                                    <div className="flex-1" />
                                    <button
                                        type="button"
                                        onClick={() => setIsRecurring(!isRecurring)}
                                        className={`p-2 rounded-xl transition-colors ${isRecurring ? 'bg-purple-500/20 text-purple-400' : 'text-neutral-500 hover:text-white'}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74-2.74L3 12" /></svg>
                                    </button>
                                    <div className="flex-1" />
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 text-neutral-500 hover:text-white transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!title || !time}
                                        className="p-2 bg-cyan-500 rounded-xl text-black disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>

                                {isRecurring && (
                                    <div className="flex justify-between pt-2 border-t border-white/5">
                                        {DAYS.map(day => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => toggleDay(day)}
                                                className={`text-[10px] w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedDays.includes(day)
                                                        ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(188,19,254,0.4)]'
                                                        : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
                                                    }`}
                                            >
                                                {day[0]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
