import React from 'react';
import { cn } from '../../utils/cn';

export interface LoadingStateProps {
  rows?: number;
  className?: string;
  message?: string;
}

export function LoadingState({ rows = 4, className, message }: LoadingStateProps) {
  return (
    <div className={cn('w-full space-y-3 bg-white p-5 border border-slate-200 rounded-xl', className)}>
      {message && <p className="text-xs text-slate-400 font-medium mb-3">{message}</p>}
      <div className="animate-pulse space-y-2.5">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 pt-1">
            <div className="h-3.5 bg-slate-100 rounded w-1/4" />
            <div className="h-3.5 bg-slate-100 rounded w-1/3" />
            <div className="h-3.5 bg-slate-100 rounded w-1/6" />
            <div className="h-3.5 bg-slate-100 rounded w-1/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
