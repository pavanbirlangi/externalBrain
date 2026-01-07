'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import DashboardLayout from '@/components/DashboardLayout';
import DateStrip from '@/components/DateStrip';
import TaskList from '@/components/TaskList';
import FloatingInput from '@/components/FloatingInput';
import ConsistencyHeatmap from '@/components/ConsistencyHeatmap';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Task {
  taskId: string;
  title: string;
  status: string;
  remindAt: string;
  type: string;
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [showStats, setShowStats] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/tasks?date=${dateStr}`);
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
      if (data.streak !== undefined) {
        setStreak(data.streak);
      }
      if (data.heatmap) {
        setHeatmapData(data.heatmap);
      }
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedDate]);

  const handleAddTask = async (title: string, time: string, recurrence?: string[]) => {
    // Optimistic Update (optional, but let's wait for server for simplicity first)
    // Construct ISO string from selected date + time
    const [hours, minutes] = time.split(':');
    const remindAt = new Date(selectedDate);
    remindAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          remindAt: remindAt.toISOString(),
          type: 'task',
          recurrence,
        }),
      });
      fetchTasks(); // Refresh
    } catch (error) {
      console.error('Failed to add task', error);
    }
  };

  const handleToggleTask = async (taskId: string, status: string) => {
    // Optimistic Update
    setTasks(prev => prev.map(t => t.taskId === taskId ? { ...t, status } : t));

    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status }),
      });
    } catch (error) {
      console.error('Failed to update task', error);
      fetchTasks(); // Revert on error
    }
  };

  const handleUpdateTask = async (taskId: string, title: string, isVirtual?: boolean, fromTemplateId?: string, remindAt?: string) => {
    try {
      if (isVirtual) {
        // Materialize Virtual Task
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            remindAt, // Use the virtual date
            type: 'task',
            fromTemplateId, // Link to template
          }),
        });
      } else {
        // Normal Update
        await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, title }),
        });
      }
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string, mode: 'single' | 'series' = 'single', date?: string, templateId?: string) => {
    try {
      let url = `/api/tasks?taskId=${taskId}&mode=${mode}`;
      if (date) url += `&date=${date}`;
      if (templateId) url += `&templateId=${templateId}`;

      await fetch(url, {
        method: 'DELETE',
      });
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return (
    <DashboardLayout>
      <header className="flex justify-between items-center mb-6 mt-2">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            Command Center
          </h1>
          <p className="text-xs text-neutral-500 font-medium tracking-wider uppercase">
            External Brain v1.0
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Streak Counter */}
          <div className="flex items-center space-x-1 bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20">
            <span className="text-lg">🔥</span>
            <span className="text-orange-400 font-bold text-sm">{streak}</span>
          </div>

          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[1px]">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-xs font-bold">
              PB
            </div>
          </div>
        </div>
      </header>

      <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <div className="flex-1 overflow-y-auto no-scrollbar mask-gradient-b md:mask-none">
        <TaskList
          tasks={tasks}
          loading={loading}
          onToggle={handleToggleTask}
          onDelete={handleDeleteTask}
          onUpdate={handleUpdateTask}
        />

        {/* Brain Health / Stats Section */}
        <div className="mt-8 mb-24 px-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center space-x-2 text-neutral-500 hover:text-cyan-400 transition-colors text-sm font-medium mb-4 mx-auto"
          >
            <Activity size={16} />
            <span>Brain Activity</span>
            {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-[#111] border border-white/5 rounded-2xl p-4 shadow-inner">
                  <h3 className="text-xs text-neutral-400 uppercase tracking-wider mb-3">Consistency Map</h3>
                  <ConsistencyHeatmap data={heatmapData} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <FloatingInput onAddTask={handleAddTask} />
    </DashboardLayout>
  );
}
