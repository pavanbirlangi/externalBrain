'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (mode: 'single' | 'series') => void;
    isRecurring: boolean;
}

export default function DeleteModal({ isOpen, onClose, onConfirm, isRecurring }: DeleteModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <div className="bg-[#111] border border-white/10 p-6 rounded-3xl w-full max-w-sm mx-4 shadow-2xl pointer-events-auto">
                            <h3 className="text-xl font-bold text-white mb-2">Delete Task?</h3>
                            <p className="text-neutral-400 text-sm mb-6">
                                This task is part of a recurring series.
                            </p>

                            <div className="flex flex-col space-y-3">
                                <button
                                    onClick={() => onConfirm('single')}
                                    className="w-full py-3 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 transition-colors font-medium"
                                >
                                    Delete for Today Only
                                </button>
                                <button
                                    onClick={() => onConfirm('series')}
                                    className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium border border-red-500/20"
                                >
                                    Delete Entire Series
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full py-2 text-neutral-500 hover:text-white transition-colors text-sm mt-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
