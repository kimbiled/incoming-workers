'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import SectionTitle from '@/components/SectionTitle';
import SkeletonGrid from '@/components/SkeletonGrid';
import EmptyState from '@/components/EmptyState';
import ShiftCard from '@/components/ShiftCard';
import { Th, Td } from '@/components/Table';
import { usePresence } from '@/hooks/usePresence';
import { usePolling } from '@/hooks/usePolling';
import { fmtTime, durationHHmm } from '@/lib/date';
import type { Presence } from '@/types/presence';

export default function LivePresencePanel({
  dateParam,
  pollMs,
  locationFilter,
}: {
  dateParam: string;
  pollMs: number;
  locationFilter?: string | null;
}) {
  const { rows, loading, error, load } = usePresence();
  const [query, setQuery] = useState('');

  usePolling(() => load(dateParam), pollMs, [dateParam]);
  useEffect(() => {
    load(dateParam);
  }, [dateParam, load]);

  const selectedDay = useMemo(
    () => dayjs(dateParam, 'DD.MM.YYYY'),
    [dateParam],
  );

  const rowsForDay = useMemo(() => {
    if (!dateParam) return rows;

    const [dd, mm, yyyy] = dateParam.split('.');
    if (!dd || !mm || !yyyy) return rows;

    const target = `${yyyy}-${mm}-${dd}`; 

    return rows.filter((r) => {
      if (!r.uslp_DateBegin) return false;
      const dayPart = r.uslp_DateBegin.slice(0, 10);
      return dayPart === target;
    });
  }, [rows, dateParam]);

  const sorted = useMemo(() => {
    return [...rowsForDay].sort(
      (a, b) =>
        new Date(b.uslp_DateBegin).valueOf() -
        new Date(a.uslp_DateBegin).valueOf(),
    );
  }, [rowsForDay]);

  const active = useMemo(() => {
    const base = sorted.filter((r) => !r.uslp_DateEnd);
    if (!locationFilter) return base;
    return base.filter((r) => r.loc_Name === locationFilter);
  }, [sorted, locationFilter]);

  const finished = useMemo(() => {
    const base = sorted.filter((r) => !!r.uslp_DateEnd);
    if (!locationFilter) return base;
    return base.filter((r) => r.loc_Name === locationFilter);
  }, [sorted, locationFilter]);

  const filterByQuery = (arr: Presence[]) => {
    if (!query.trim()) return arr;
    const q = query.toLowerCase();
    return arr.filter(
      (r) =>
        r.usr_Name?.toLowerCase().includes(q) ||
        r.loc_Name?.toLowerCase().includes(q),
    );
  };

  const filteredActive = useMemo(() => filterByQuery(active), [active, query]);
  const LOCATIONS = ['Office', 'Farhi Hall', 'SharZhum', 'Farhi'] as const;

  const groupedActive = useMemo(() => {
    const byLoc: Record<string, Presence[]> = {};
    LOCATIONS.forEach((loc) => {
      byLoc[loc] = [];
    });

    filteredActive.forEach((r) => {
      const loc = r.loc_Name ?? '';
      if (LOCATIONS.includes(loc as any)) {
        byLoc[loc].push(r);
      }
    });

    return byLoc;
  }, [filteredActive]);

  const filteredFinished = useMemo(
    () => filterByQuery(finished),
    [finished, query],
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">Присутствие сотрудников</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Поиск: ФИО или локация"
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500 md:w-80"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => load(dateParam)}
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-black"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Ошибка: {error}
        </div>
      )}

      <section className="mb-8">
        <SectionTitle title="Сейчас на смене" count={filteredActive.length} />
        {loading && rows.length === 0 ? (
          <SkeletonGrid />
        ) : filteredActive.length === 0 ? (
          <EmptyState text="Никого нет на смене." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredActive.map((row) => (
              <ShiftCard
                key={`${row.usr_ID}-${row.uslp_DateBegin}`}
                row={row}
                live
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          title={`История за ${dateParam}`}
          count={filteredFinished.length}
        />
        {loading && rows.length === 0 ? (
          <SkeletonGrid />
        ) : filteredFinished.length === 0 ? (
          <EmptyState text="Пока нет завершённых смен." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Сотрудник</Th>
                    <Th>Локация</Th>
                    <Th>Начало</Th>
                    <Th>Завершение</Th>
                    <Th>Итого</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFinished.map((r) => (
                    <tr
                      key={`${r.usr_ID}-${r.uslp_DateBegin}`}
                      className="hover:bg-gray-50/60"
                    >
                      {/* Сотрудник */}
                      <Td className="font-medium">{r.usr_Name}</Td>

                      {/* Локация */}
                      <Td>{r.loc_Name || '—'}</Td>

                      {/* Начало */}
                      <Td>{fmtTime(r.uslp_DateBegin)}</Td>

                      {/* Завершение */}
                      <Td>{fmtTime(r.uslp_DateEnd)}</Td>

                      {/* ИТОГО */}
                      <Td className="text-right">
                        {r.uslp_DateEnd
                          ? durationHHmm(r.uslp_DateBegin, r.uslp_DateEnd)
                          : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
