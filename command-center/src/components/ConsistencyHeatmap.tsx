'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, getDay } from 'date-fns';
import clsx from 'clsx';

interface ConsistencyHeatmapProps {
    data: Record<string, number>; // date (YYYY-MM-DD) -> count
}

export default function ConsistencyHeatmap({ data }: ConsistencyHeatmapProps) {
    // Generate last ~3 months (90 days)
    // Align to start of week (Sunday) to make the grid look nice like GitHub
    const today = new Date();
    const startDate = subDays(today, 90); // Approx 3 months
    // Adjust start date to be the previous Sunday to align grid
    const alignedStartDate = startOfWeek(startDate);

    const days = eachDayOfInterval({
        start: alignedStartDate,
        end: today
    });

    // Determine max count for color scaling (cap at 5+ for max intensity)
    const getColor = (count: number) => {
        if (count === 0) return 'bg-neutral-900/50 border-neutral-800';
        if (count === 1) return 'bg-cyan-900/40 border-cyan-800/50';
        if (count === 2) return 'bg-cyan-700/50 border-cyan-600/50';
        if (count === 3) return 'bg-cyan-500/60 border-cyan-400/50';
        return 'bg-cyan-400 border-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.6)]';
    };

    return (
        <div className="w-full overflow-x-auto no-scrollbar">
            <div className="flex flex-col gap-1 min-w-max">
                {/* We need to render columns (weeks). 
            CSS Grid with 7 rows (days) and auto columns is easiest. 
            But standard flex wrap is row-based. 
            Let's use a CSS Grid with `grid-template-rows: repeat(7, 1fr)` and `grid-auto-flow: column`.
        */}
                <div className="grid grid-rows-7 grid-flow-col gap-1">
                    {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const count = data[dateStr] || 0;

                        return (
                            <div key={dateStr} className="relative group">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: Math.random() * 0.5 }}
                                    className={clsx(
                                        "w-3 h-3 rounded-sm border transition-all duration-300",
                                        getColor(count)
                                    )}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                    <div className="bg-black/90 border border-white/10 text-xs text-white px-2 py-1 rounded whitespace-nowrap backdrop-blur-md">
                                        {format(day, 'MMM d, yyyy')}: {count} tasks
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend / Month Labels could go here but keeping it minimal for "Cyber-Zen" */}
            </div>
        </div>
    );
}
