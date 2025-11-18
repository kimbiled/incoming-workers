'use client';
import React from 'react';
import dayjs from 'dayjs';
import { classNames } from '@/lib/classNames';

export default function HeaderBar({
  date,
  setDate,
  pollMs,
  setPollMs,
}: {
  date: dayjs.Dayjs;
  setDate: (d: dayjs.Dayjs) => void;
  pollMs: number;
  setPollMs: (n: number) => void;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-600 px-3 py-1 text-white shadow">
            Live
          </div>
          <div className="text-lg font-semibold">
            Присутствие сотрудников
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm">
            <span className="text-gray-600">Дата</span>
            <input
              type="date"
              value={date.format('YYYY-MM-DD')}
              onChange={(e) => setDate(dayjs(e.target.value))}
              className="rounded-md outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm">
            <span className="text-gray-600">Интервал</span>
            <select
              value={pollMs}
              onChange={(e) => setPollMs(Number(e.target.value))}
              className="rounded-md outline-none"
            >
              <option value={5000}>5 сек</option>
              <option value={10000}>10 сек</option>
              <option value={15000}>15 сек</option>
              <option value={30000}>30 сек</option>
              <option value={60000}>1 мин</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
