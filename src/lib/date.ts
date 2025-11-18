import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export function fmtTime(ts?: string | null) {
  if (!ts) return '—';
  const m = dayjs(ts);
  return m.isValid() ? m.format('HH:mm') : '—';
}

export function durationHHmm(beginISO: string, endISO?: string | null) {
  const start = dayjs(beginISO);
  const end = endISO ? dayjs(endISO) : dayjs();
  if (!start.isValid() || !end.isValid()) return '—';
  const diffMs = end.diff(start);
  if (diffMs < 0) return '—';
  const dur = dayjs.duration(diffMs);
  const hh = Math.floor(dur.asHours()).toString().padStart(2, '0');
  const mm = Math.floor(dur.minutes()).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
