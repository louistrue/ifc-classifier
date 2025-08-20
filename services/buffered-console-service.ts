/**
 * Buffered Console Service
 * 
 * This service batches console updates to prevent excessive React re-renders
 * while maintaining a responsive live view. It uses requestAnimationFrame
 * and a ring buffer to optimize performance.
 */

import { useState, useEffect } from 'react';

export interface ConsoleUpdate {
    logs: string[];
    status: string;
    percent: number;
    matchCount?: number;
}

export class BufferedConsoleService {
    private buffer: string[] = [];
    private subscribers: Set<(update: ConsoleUpdate) => void> = new Set();
    private rafId: number | null = null;
    private lastUpdate = 0;
    private updateInterval = 100; // Minimum ms between updates
    private maxBufferSize = 500; // Maximum logs to keep
    private ringBufferStart = 0;

    // Current state
    private currentStatus = "";
    private currentPercent = 0;
    private currentMatchCount = 0;
    private hasStarted = false; // Track if processing has actually started

    // Performance metrics
    private droppedLogs = 0;
    private lastFlushTime = 0;

    constructor() {
        // Pre-allocate buffer for better performance
        this.buffer = new Array(this.maxBufferSize).fill("");

        // Auto-adjust update interval based on performance
        this.autoAdjustInterval();
    }

    /**
     * Auto-adjust update interval based on system performance
     */
    private autoAdjustInterval() {
        if (typeof window !== 'undefined' && 'performance' in window) {
            // Monitor frame rate and adjust accordingly
            let frameCount = 0;
            let lastTime = performance.now();

            const checkPerformance = () => {
                frameCount++;
                if (frameCount >= 60) {
                    const currentTime = performance.now();
                    const elapsed = currentTime - lastTime;
                    const fps = (frameCount / elapsed) * 1000;

                    // Adjust interval based on FPS
                    if (fps < 30) {
                        // Poor performance, increase interval
                        this.updateInterval = Math.min(200, this.updateInterval * 1.5);
                    } else if (fps > 50) {
                        // Good performance, can decrease interval slightly
                        this.updateInterval = Math.max(50, this.updateInterval * 0.9);
                    }

                    frameCount = 0;
                    lastTime = currentTime;
                }

                requestAnimationFrame(checkPerformance);
            };

            // Start monitoring after a delay
            setTimeout(() => requestAnimationFrame(checkPerformance), 1000);
        }
    }

    /**
     * Add a log entry to the buffer
     */
    addLog(message: string) {
        const index = this.ringBufferStart % this.maxBufferSize;
        this.buffer[index] = message;
        this.ringBufferStart++;

        // Track if we're dropping logs
        if (this.ringBufferStart > this.maxBufferSize) {
            this.droppedLogs++;
        }

        this.scheduleUpdate();
    }

    /**
     * Add multiple logs at once (more efficient)
     */
    addLogs(messages: string[]) {
        for (const msg of messages) {
            const index = this.ringBufferStart % this.maxBufferSize;
            this.buffer[index] = msg;
            this.ringBufferStart++;
        }

        if (this.ringBufferStart > this.maxBufferSize) {
            this.droppedLogs += this.ringBufferStart - this.maxBufferSize;
        }

        this.scheduleUpdate();
    }

    /**
 * Update status and progress
 */
    updateProgress(status: string, percent: number, matchCount?: number) {
        this.currentStatus = status;
        this.currentPercent = percent;
        if (matchCount !== undefined) {
            this.currentMatchCount = matchCount;
        }

        // Mark as started when we get the first meaningful update
        if (status && status.trim() !== "" && !this.hasStarted) {
            this.hasStarted = true;
        }

        this.scheduleUpdate();
    }

    /**
     * Schedule an update using RAF with throttling
     */
    private scheduleUpdate() {
        const now = Date.now();

        // Throttle updates
        if (now - this.lastUpdate < this.updateInterval) {
            // Schedule for later if not already scheduled
            if (!this.rafId) {
                this.rafId = requestAnimationFrame(() => this.flush());
            }
            return;
        }

        // Cancel any pending RAF
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        // Schedule immediate update
        this.rafId = requestAnimationFrame(() => this.flush());
    }

    /**
 * Flush buffer to subscribers
 */
    private flush() {
        // Don't flush until processing has actually started
        if (!this.hasStarted && this.currentPercent === 0 && !this.currentStatus) {
            return;
        }

        const now = Date.now();
        this.lastUpdate = now;
        this.rafId = null;

        // Get visible logs from ring buffer
        const visibleLogs: string[] = [];
        const start = Math.max(0, this.ringBufferStart - this.maxBufferSize);
        const end = this.ringBufferStart;

        for (let i = start; i < end; i++) {
            const index = i % this.maxBufferSize;
            if (this.buffer[index]) {
                visibleLogs.push(this.buffer[index]);
            }
        }

        // Only show last 100 logs in UI for performance
        const displayLogs = visibleLogs.slice(-100);

        // Notify all subscribers
        const update: ConsoleUpdate = {
            logs: displayLogs,
            status: this.currentStatus,
            percent: this.currentPercent,
            matchCount: this.currentMatchCount
        };

        // Track flush performance
        this.lastFlushTime = Date.now() - now;

        this.subscribers.forEach(callback => {
            try {
                callback(update);
            } catch (error) {
                console.error('BufferedConsole: Subscriber error', error);
            }
        });
    }

    /**
     * Subscribe to console updates
     */
    subscribe(callback: (update: ConsoleUpdate) => void): () => void {
        this.subscribers.add(callback);

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
 * Force an immediate flush (use sparingly)
 */
    forceFlush() {
        // Mark as started if forcing a flush
        if (!this.hasStarted && (this.currentStatus || this.currentPercent > 0)) {
            this.hasStarted = true;
        }

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.flush();
    }

    /**
 * Clear all logs and reset state
 */
    clear() {
        this.buffer = new Array(this.maxBufferSize).fill("");
        this.ringBufferStart = 0;
        this.currentStatus = "";
        this.currentPercent = 0;
        this.currentMatchCount = 0;
        this.droppedLogs = 0;
        this.hasStarted = false; // Reset started flag

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Don't flush after clear to avoid showing empty state
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            droppedLogs: this.droppedLogs,
            bufferSize: Math.min(this.ringBufferStart, this.maxBufferSize),
            lastFlushTime: this.lastFlushTime,
            subscriberCount: this.subscribers.size
        };
    }

    /**
     * Adjust update interval for performance tuning
     */
    setUpdateInterval(ms: number) {
        this.updateInterval = Math.max(16, Math.min(1000, ms)); // Clamp between 16ms and 1s
    }
}

// Singleton instance
let instance: BufferedConsoleService | null = null;

export function getBufferedConsole(): BufferedConsoleService {
    if (!instance) {
        instance = new BufferedConsoleService();
    }
    return instance;
}

// Export helper hook for React components
export function useBufferedConsole() {
    const [state, setState] = useState<ConsoleUpdate>({
        logs: [],
        status: "",
        percent: 0,
        matchCount: 0
    });

    useEffect(() => {
        const console = getBufferedConsole();
        const unsubscribe = console.subscribe(setState);

        return unsubscribe;
    }, []);

    return state;
}
