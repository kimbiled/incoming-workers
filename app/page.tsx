'use client';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import LivePresencePanel from '@/features/presence/LivePresencePanel';
import HeaderBar from '@/components/HeaderBar';
import FaceIdKiosk from '@/features/faceid/FaceIdKiosk';

export default function Page() {
  const [date, setDate] = useState(() => dayjs());
  const [pollMs] = useState(
    Number(process.env.NEXT_PUBLIC_DEFAULT_POLL_MS ?? 15000),
  );
  const dateParam = useMemo(() => date.format('DD.MM.YYYY'), [date]);
  const [presenceRefreshKey, setPresenceRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar
        date={date}
        setDate={setDate}
      />
      <main className="mx-auto max-w-7xl px-4 py-4">
        <FaceIdKiosk
          dateParam={dateParam}
          locationFilter={null}
          onMarked={() => setPresenceRefreshKey((value) => value + 1)}
        />
        <LivePresencePanel
          dateParam={dateParam}
          pollMs={pollMs}
          locationFilter={null}
          refreshToken={presenceRefreshKey}
        />
      </main>
    </div>
  );
}
