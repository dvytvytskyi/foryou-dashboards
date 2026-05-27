'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import styles from './DatePicker.module.css';

interface DatePickerWithRangeProps {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  onApply: (start: string, end: string) => void;
  className?: string;
  openTrigger?: number;
}

export function DatePickerWithRange({
  startDate,
  endDate,
  onApply,
  className,
  openTrigger
}: DatePickerWithRangeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Open the popover automatically when triggered from parent
  useEffect(() => {
    if (openTrigger && openTrigger > 0) {
      setIsOpen(true);
    }
  }, [openTrigger]);

  const [date, setDate] = useState<DateRange | undefined>(() => ({
    from: startDate ? new Date(startDate) : undefined,
    to: endDate ? new Date(endDate) : undefined,
  }));
  
  const [currentMonth, setCurrentMonth] = useState<Date>(date?.from || new Date());

  // Sync internal state when props change externally (like clicking a preset)
  useEffect(() => {
    if (!isOpen) {
      setDate({
        from: startDate ? new Date(startDate) : undefined,
        to: endDate ? new Date(endDate) : undefined,
      });
      if (startDate) {
        setCurrentMonth(new Date(startDate));
      }
    }
  }, [startDate, endDate, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleApply = () => {
    if (date?.from) {
      const start = format(date.from, 'yyyy-MM-dd');
      const end = date.to ? format(date.to, 'yyyy-MM-dd') : start;
      onApply(start, end);
      setIsOpen(false);
    }
  };

  return (
    <div className={`${styles.container} ${className || ''}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.trigger}
      >
        <CalendarIcon size={16} className={styles.icon} />
        {date?.from ? (
          date.to ? (
            <>
              {format(date.from, 'MMM dd, yyyy')} - {format(date.to, 'MMM dd, yyyy')}
            </>
          ) : (
            format(date.from, 'MMM dd, yyyy')
          )
        ) : (
          <span>Pick a date range</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.popover}>
          <DayPicker
            mode="range"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            className={styles.calendar}
          />
          <div className={styles.footer}>
            <span className={styles.hintText}>Double click to select new date</span>
            <div className={styles.actions}>
              <button onClick={() => setIsOpen(false)} className={styles.cancelBtn}>Cancel</button>
              <button 
                onClick={handleApply} 
                disabled={!date?.from}
                className={styles.applyBtn}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
