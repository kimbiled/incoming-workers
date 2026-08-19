'use client';

import React, { useEffect, useState } from 'react';
import AdminPanel from './AdminPanel';

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '2468';
const STORAGE_KEY = 'faceid_admin_unlocked';

export default function AdminGate() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pin === ADMIN_PIN) {
      window.localStorage.setItem(STORAGE_KEY, '1');
      setUnlocked(true);
      setError('');
      return;
    }

    setError('Неверный PIN');
  }

  if (unlocked) return <AdminPanel />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-gray-950">Доступ к админке</h1>
        <p className="mt-1 text-sm text-gray-500">Введите PIN администратора.</p>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          className="mt-5 w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl font-semibold tracking-[0.4em] outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

        <button
          type="submit"
          className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
        >
          Войти
        </button>
      </form>
    </div>
  );
}
