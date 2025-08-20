/**
 * Simple Progress Component
 * 
 * Ultra-lightweight progress indicator with minimal overhead.
 * No logs, no animations, just pure progress display.
 */

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface SimpleProgressProps {
  percent: number;
  status: string;
  matchCount?: number;
  active: boolean;
  className?: string;
}

export const SimpleProgress = memo(({
  percent,
  status,
  matchCount,
  active,
  className
}: SimpleProgressProps) => {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-2">
          {active ? (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          ) : (
            <div className="w-2 h-2 bg-muted-foreground rounded-full" />
          )}
          <span className="text-sm font-medium">
            {active ? 'Processing' : 'Complete'}
          </span>
        </div>
        <div className="text-sm tabular-nums text-muted-foreground">
          {percent}%
        </div>
      </div>

      {/* Status Text - Very Simple */}
      <div className="px-3">
        <div className="text-xs text-muted-foreground text-center">
          {status}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-3 pb-3">
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Match Count - Only shown when complete */}
      {!active && matchCount !== undefined && (
        <div className="px-3 pb-3 text-center">
          <div className="text-sm font-medium text-primary">
            {matchCount > 0 ? `✓ ${matchCount} matches found` : 'No matches found'}
          </div>
        </div>
      )}
    </div>
  );
});

SimpleProgress.displayName = 'SimpleProgress';
