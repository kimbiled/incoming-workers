'use client';

import React, { useEffect, useState } from 'react';

type SystemStatus = {
  faceid?: {
    ok?: boolean;
    faceid?: {
      templates?: number;
    };
    webhook_queue?: {
      pending?: number;
      last_sent_at?: string | null;
      last_error?: string | null;
    };
  };
  tillypad?: {
    ok?: boolean;
    latency_ms?: number;
  };
  checked_at?: string;
};

const STATUS_POLL_MS = Number(process.env.NEXT_PUBLIC_STATUS_POLL_MS ?? 60000);

export default function SystemStatusBadge() {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch('/faceid-api/system/status', { cache: 'no-store' });
        const data = (await res.json()) as SystemStatus;
        if (alive) setStatus(data);
      } catch {
        if (alive) {
          setStatus({
            faceid: { ok: false },
            tillypad: { ok: false },
          });
        }
      }
    }

    void load();
    const timer = window.setInterval(load, STATUS_POLL_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const faceIdOk = Boolean(status?.faceid?.ok);
  const tillypadOk = Boolean(status?.tillypad?.ok);
  const pending = status?.faceid?.webhook_queue?.pending ?? 0;
  const lastSync = status?.checked_at;

  return (
    <div className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm sm:w-fit sm:min-w-72">
      <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-5">
        <StatusLine ok={faceIdOk} label="FaceID работает" />
        <StatusLine ok={tillypadOk} label="Tillypad доступен" />
        <div className="flex items-center justify-between gap-3">
          <span>Последняя синхронизация</span>
          <span className="font-semibold text-gray-950">{lastSync ? formatTime(lastSync) : '—'}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Неотправленные отметки</span>
          <span className={pending > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>
            {pending}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span
        className={[
          'h-2.5 w-2.5 rounded-full',
          ok ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]' : 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.10)]',
        ].join(' ')}
      />
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
