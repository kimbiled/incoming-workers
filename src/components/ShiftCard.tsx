import React from 'react';
import Chip from '@/components/Chip';
import { fmtTime, durationHHmm } from '@/lib/date';
import type { Presence } from '@/types/presence';

export default function ShiftCard({
  row,
  live = false,
}: {
  row: Presence;
  live?: boolean;
}) {
  const {
    usr_Name,
    loc_Name,
    usrr_Name,
    uslp_DateBegin,
    uslp_DateEnd,
  } = row;

  const started = fmtTime(uslp_DateBegin);
  const ended = fmtTime(uslp_DateEnd);
  const dur = durationHHmm(uslp_DateBegin, uslp_DateEnd);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{usr_Name}</div>
          {usrr_Name && (
            <div className="truncate text-xs text-gray-500">{usrr_Name}</div>
          )}
        </div>
        {live ? <Chip tone="green">На смене</Chip> : <Chip>Завершил</Chip>}
      </div>

      <div className="mb-3 text-sm text-gray-600">{loc_Name || '—'}</div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="text-xs text-gray-500">Начало</div>
          <div className="font-medium">{started}</div>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="text-xs text-gray-500">Завершение</div>
          <div className="font-medium">{ended}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-blue-50 p-3">
        <div className="text-xs text-blue-700">Отработано</div>
        <div className="text-lg font-semibold text-blue-900">{dur}</div>
      </div>
    </div>
  );
}
