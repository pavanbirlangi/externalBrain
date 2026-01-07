'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative selection:bg-cyan-500 selection:text-black">
            {/* Background Glows */}
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />

            <motion.main
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative z-10 w-full max-w-7xl mx-auto h-screen flex flex-col p-4 md:p-8"
            >
                {children}
            </motion.main>
        </div>
    );
}
