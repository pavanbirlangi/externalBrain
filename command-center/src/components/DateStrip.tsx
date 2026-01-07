'use client';

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, addDays, isSameDay } from 'date-fns';
import { clsx } from 'clsx';

interface DateStripProps {
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
}

export default function DateStrip({ selectedDate, onSelectDate }: DateStripProps) {
    const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i - 2)); // 2 days back, 11 days forward
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            // Center the selected date (simple logic)
            // scrollRef.current.scrollLeft = 100; 
        }
    }, []);

    return (
        <div className="w-full overflow-x-auto no-scrollbar py-4" ref={scrollRef}>
            <div className="flex space-x-3 px-2">
                {dates.map((date, index) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const isToday = isSameDay(date, new Date());

                    return (
                        <motion.button
                            key={index}
                            onClick={() => onSelectDate(date)}
                            whileTap={{ scale: 0.95 }}
                            className={clsx(
                                "flex flex-col items-center justify-center min-w-[60px] h-[80px] rounded-2xl border transition-all duration-300",
                                isSelected
                                    ? "bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(0,243,255,0.3)]"
                                    : "bg-neutral-900/50 border-white/5 hover:border-white/10"
                            )}
                        >
                            <span className={clsx("text-xs font-medium mb-1", isSelected ? "text-cyan-400" : "text-neutral-500")}>
                                {isToday ? 'TODAY' : format(date, 'EEE').toUpperCase()}
                            </span>
                            <span className={clsx("text-xl font-bold", isSelected ? "text-white" : "text-neutral-300")}>
                                {format(date, 'd')}
                            </span>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
