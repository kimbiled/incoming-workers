'use client';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import LivePresencePanel from '@/features/presence/LivePresencePanel';
import HeaderBar from '@/components/HeaderBar';

export default function FarhiPage() {
  const [date, setDate] = useState(() => dayjs());
  const [pollMs, setPollMs] = useState(
    Number(process.env.NEXT_PUBLIC_DEFAULT_POLL_MS ?? 15000),
  );
  const dateParam = useMemo(() => date.format('DD.MM.YYYY'), [date]);

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar
        date={date}
        setDate={setDate}
        pollMs={pollMs}
        setPollMs={setPollMs}
      />
      <main className="mx-auto max-w-7xl px-4 py-4">
        <LivePresencePanel
          dateParam={dateParam}
          pollMs={pollMs}
          locationFilter="Farhi"
        />
      </main>
    </div>
  );
}
