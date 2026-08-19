'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SectionTitle from '@/components/SectionTitle';
import SkeletonGrid from '@/components/SkeletonGrid';
import EmptyState from '@/components/EmptyState';
import SystemStatusBadge from '@/components/SystemStatusBadge';
import { usePresence } from '@/hooks/usePresence';
import { usePolling } from '@/hooks/usePolling';
import { fmtTime, durationHHmm } from '@/lib/date';
import type { Presence } from '@/types/presence';

type PresenceGroup = {
  key: string;
  name: string;
  role: string;
  location: string;
  shifts: Presence[];
};

type SortKey = 'name' | 'role' | 'location' | 'arrival' | 'leave' | 'total';
type SortState = {
  key: SortKey;
  direction: 'asc' | 'desc';
} | null;

export default function LivePresencePanel({
  dateParam,
  pollMs,
  locationFilter,
  refreshToken = 0,
}: {
  dateParam: string;
  pollMs: number;
  locationFilter?: string | string[] | null;
  refreshToken?: number;
}) {
  const { rows, loading, error, load } = usePresence();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(null);

  usePolling(() => load(dateParam), pollMs, [dateParam]);
  useEffect(() => {
    load(dateParam);
  }, [dateParam, load]);

  useEffect(() => {
    if (refreshToken > 0) {
      load(dateParam);
    }
  }, [refreshToken, dateParam, load]);

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

  const rowsByDefaultTime = useMemo(() => {
    return [...rowsForDay].sort(
      (a, b) =>
        new Date(a.uslp_DateBegin).valueOf() -
        new Date(b.uslp_DateBegin).valueOf(),
    );
  }, [rowsForDay]);

  const active = useMemo(() => {
    const base = rowsByDefaultTime.filter((r) => !r.uslp_DateEnd);
    if (!locationFilter) return base;
    return base.filter((r) => matchesLocation(r.loc_Name, locationFilter));
  }, [rowsByDefaultTime, locationFilter]);

  const filterByQuery = useCallback((arr: Presence[]) => {
    if (!query.trim()) return arr;
    const q = query.toLowerCase();
    return arr.filter(
      (r) =>
        r.usr_Name?.toLowerCase().includes(q) ||
        r.loc_Name?.toLowerCase().includes(q) ||
        r.usrr_Name?.toLowerCase().includes(q),
    );
  }, [query]);

  const filteredActive = useMemo(() => filterByQuery(active), [active, filterByQuery]);

  const filteredRows = useMemo(() => {
    const base = locationFilter
      ? rowsByDefaultTime.filter((row) => matchesLocation(row.loc_Name, locationFilter))
      : rowsByDefaultTime;
    return filterByQuery(base);
  }, [rowsByDefaultTime, locationFilter, filterByQuery]);

  const displayRows = useMemo(() => dedupePresenceRows(filteredRows), [filteredRows]);
  const displayActive = useMemo(() => dedupePresenceRows(filteredActive), [filteredActive]);
  const groupedRows = useMemo(() => groupPresenceRows(displayRows, sort), [displayRows, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">Присутствие сотрудников</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Поиск: ФИО, должность или локация"
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500 md:w-80"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => load(dateParam, true)}
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-black"
          >
            Обновить
          </button>
          {sort && (
            <button
              onClick={() => setSort(null)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Сброс
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
          {error}
        </div>
      )}

      <section>
        <SectionTitle
          title={`История за ${dateParam}`}
          count={displayRows.length}
        />
        <SystemStatusBadge />
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            <StatusDot active /> На смене: {displayActive.length}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">
            <StatusDot active={false} /> Не на смене
          </span>
        </div>
        {loading && rows.length === 0 ? (
          <SkeletonGrid />
        ) : displayRows.length === 0 ? (
          <EmptyState text="Пока нет отметок за выбранный день." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr>
                    <GroupedTh sortKey="name" sort={sort} onSort={toggleSort}>Имя</GroupedTh>
                    <GroupedTh sortKey="role" sort={sort} onSort={toggleSort}>Должность</GroupedTh>
                    <GroupedTh sortKey="location" sort={sort} onSort={toggleSort}>Локация</GroupedTh>
                    <GroupedTh sortKey="arrival" sort={sort} onSort={toggleSort}>Приход</GroupedTh>
                    <GroupedTh sortKey="leave" sort={sort} onSort={toggleSort}>Уход</GroupedTh>
                    <GroupedTh sortKey="total" sort={sort} onSort={toggleSort}>Итого зафиксировано</GroupedTh>
                  </tr>
                </thead>

                <tbody>
                  {groupedRows.map((group) =>
                    group.shifts.map((shift, index) => (
                      <tr
                        key={presenceShiftKey(group.key, shift, index)}
                        className="hover:bg-gray-50/60"
                      >
                        {index === 0 && (
                          <>
                            <GroupedTd rowSpan={group.shifts.length} strong>
                              {group.name}
                            </GroupedTd>
                            <GroupedTd rowSpan={group.shifts.length}>
                              {group.role}
                            </GroupedTd>
                            <GroupedTd rowSpan={group.shifts.length}>
                              {group.location}
                            </GroupedTd>
                          </>
                        )}
                        <GroupedTd center>{fmtTime(shift.uslp_DateBegin)}</GroupedTd>
                        <GroupedTd center>
                          {shift.uslp_DateEnd ? (
                            fmtTime(shift.uslp_DateEnd)
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              На смене
                            </span>
                          )}
                        </GroupedTd>
                        <GroupedTd center strong={Boolean(shift.uslp_DateEnd)}>
                          {shift.uslp_DateEnd
                            ? durationHHmm(shift.uslp_DateBegin, shift.uslp_DateEnd)
                            : '—'}
                        </GroupedTd>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function presenceShiftKey(groupKey: string, shift: Presence, index: number) {
  return [
    groupKey,
    shift.usr_ID || 'no-user-id',
    shift.uslp_DateBegin || 'no-begin',
    shift.uslp_DateEnd || 'open',
    index,
  ].join('|');
}

function groupPresenceRows(rows: Presence[], sort: SortState): PresenceGroup[] {
  const map = new Map<string, PresenceGroup>();

  for (const row of rows) {
    const key = employeeGroupKey(row);

    if (!map.has(key)) {
      map.set(key, {
        key,
        name: row.usr_Name,
        role: normalizeGroupPart(row.usrr_Name) === 'faceid' ? '—' : row.usrr_Name ?? '—',
        location: row.loc_Name || '—',
        shifts: [],
      });
    }

    const group = map.get(key);
    if (!group) continue;

    if (isBetterProfileRow(row, group)) {
      group.name = row.usr_Name;
      group.role = row.usrr_Name ?? '—';
      group.location = row.loc_Name || '—';
    }

    group.shifts.push(row);
  }

  const groups = [...map.values()]
    .map((group) => ({
      ...group,
      shifts: [...group.shifts].sort(
        (a, b) =>
          new Date(a.uslp_DateBegin).valueOf() -
          new Date(b.uslp_DateBegin).valueOf(),
      ),
    }));

  return groups.sort((a, b) => compareGroups(a, b, sort));
}

function normalizeGroupPart(value?: string | null) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[?？]/g, '')
    .replace(/[ұү]/g, 'у')
    .replace(/[ә]/g, 'а')
    .replace(/[і]/g, 'и')
    .replace(/[ң]/g, 'н')
    .replace(/[ғ]/g, 'г')
    .replace(/[қ]/g, 'к')
    .replace(/[һ]/g, 'х')
    .replace(/\s+/g, ' ');
}

function dedupePresenceRows(rows: Presence[]) {
  const result: Presence[] = [];

  for (const row of rows) {
    const duplicateIndex = result.findIndex((candidate) => areSameShift(candidate, row));

    if (duplicateIndex >= 0) {
      result[duplicateIndex] = mergePresenceRows(result[duplicateIndex], row);
      continue;
    }

    result.push(row);
  }

  return result;
}

function areSameShift(left: Presence, right: Presence) {
  if (!matchesLocation(left.loc_Name, right.loc_Name || '')) return false;
  if (!looksLikeSamePerson(left.usr_Name, right.usr_Name)) return false;
  if (!sameMinute(left.uslp_DateBegin, right.uslp_DateBegin)) return false;

  if (!left.uslp_DateEnd && !right.uslp_DateEnd) return true;
  if (!left.uslp_DateEnd || !right.uslp_DateEnd) return true;
  return sameMinute(left.uslp_DateEnd, right.uslp_DateEnd);
}

function mergePresenceRows(left: Presence, right: Presence): Presence {
  const official = isFaceIdRow(left) && !isFaceIdRow(right) ? right : left;
  const fallback = official === left ? right : left;

  return {
    ...official,
    usr_Name: official.usr_Name || fallback.usr_Name,
    usrr_Name: normalizeGroupPart(official.usrr_Name) === 'faceid'
      ? fallback.usrr_Name || official.usrr_Name
      : official.usrr_Name,
    loc_Name: official.loc_Name || fallback.loc_Name,
    uslp_DateBegin: earlierDate(left.uslp_DateBegin, right.uslp_DateBegin),
    uslp_DateEnd: official.uslp_DateEnd ?? null,
  };
}

function employeeGroupKey(row: Presence) {
  return [
    normalizeNameForGrouping(row.usr_Name),
    normalizeGroupPart(row.loc_Name),
  ].join('|');
}

function normalizeNameForGrouping(value?: string | null) {
  return normalizeGroupPart(value)
    .replace(/[аеёиоуыэюя]/g, '')
    .replace(/\s/g, '');
}

function looksLikeSamePerson(left?: string | null, right?: string | null) {
  const a = normalizeNameForGrouping(left);
  const b = normalizeNameForGrouping(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function sameMinute(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  return left.slice(0, 16) === right.slice(0, 16);
}

function earlierDate(left: string, right: string) {
  return new Date(left).valueOf() <= new Date(right).valueOf() ? left : right;
}

function isFaceIdRow(row: Presence) {
  return row.usr_ID?.startsWith('faceid-') || normalizeGroupPart(row.usrr_Name) === 'faceid';
}

function isBetterProfileRow(row: Presence, group: PresenceGroup) {
  if (!isFaceIdRow(row) && normalizeGroupPart(group.role) !== 'faceid') return true;
  if (group.role === '—' && row.usrr_Name) return true;
  return false;
}

function matchesLocation(value: string | null | undefined, filter: string | string[]) {
  const normalizedValue = normalizeGroupPart(value);
  const filters = Array.isArray(filter) ? filter : [filter];
  return filters.some((item) => normalizeGroupPart(item) === normalizedValue);
}

function compareGroups(a: PresenceGroup, b: PresenceGroup, sort: SortState) {
  if (!sort) {
    return (
      firstArrival(a) - firstArrival(b) ||
      a.name.localeCompare(b.name, 'ru') ||
      a.role.localeCompare(b.role, 'ru')
    );
  }

  const direction = sort.direction === 'asc' ? 1 : -1;
  let result = 0;

  if (sort.key === 'name') result = a.name.localeCompare(b.name, 'ru');
  if (sort.key === 'role') result = a.role.localeCompare(b.role, 'ru');
  if (sort.key === 'location') result = a.location.localeCompare(b.location, 'ru');
  if (sort.key === 'arrival') result = firstArrival(a) - firstArrival(b);
  if (sort.key === 'leave') result = firstLeave(a) - firstLeave(b);
  if (sort.key === 'total') result = totalClosedMinutes(a) - totalClosedMinutes(b);

  return result * direction || a.name.localeCompare(b.name, 'ru');
}

function firstArrival(group: PresenceGroup) {
  return new Date(group.shifts[0]?.uslp_DateBegin ?? '').valueOf() || 0;
}

function firstLeave(group: PresenceGroup) {
  const firstClosed = group.shifts.find((shift) => shift.uslp_DateEnd);
  return new Date(firstClosed?.uslp_DateEnd ?? '').valueOf() || 0;
}

function totalClosedMinutes(group: PresenceGroup) {
  return group.shifts.reduce((total, shift) => {
    if (!shift.uslp_DateEnd) return total;
    const begin = new Date(shift.uslp_DateBegin).valueOf();
    const end = new Date(shift.uslp_DateEnd).valueOf();
    if (Number.isNaN(begin) || Number.isNaN(end) || end < begin) return total;
    return total + Math.floor((end - begin) / 60000);
  }, 0);
}

function GroupedTh({
  children,
  sortKey,
  sort,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className="border border-gray-200 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-gray-700">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center justify-center gap-1 hover:text-gray-950"
      >
        {children}
        <span className={active ? 'text-gray-950' : 'text-gray-400'}>
          {active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

function GroupedTd({
  children,
  rowSpan,
  strong,
  center,
}: {
  children: React.ReactNode;
  rowSpan?: number;
  strong?: boolean;
  center?: boolean;
}) {
  return (
    <td
      rowSpan={rowSpan}
      className={[
        'border border-gray-200 px-4 py-3 align-middle',
        center ? 'text-center' : '',
        strong ? 'font-semibold text-gray-950' : 'text-gray-700',
      ].join(' ')}
    >
      {children}
    </td>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'inline-block h-3 w-3 rounded-full',
        active ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]' : 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.10)]',
      ].join(' ')}
      aria-label={active ? 'На смене' : 'Не на смене'}
      title={active ? 'На смене' : 'Не на смене'}
    />
  );
}
