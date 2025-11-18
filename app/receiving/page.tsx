'use client';

import React from 'react';
import { ReceivingNote } from '@/features/receiving/ReceivingNote';
import { RESTAURANT_ID } from '@/features/receiving/constants';

export default function ReceivingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Приходная накладная</h1>
          <p className="text-gray-600">Ресторан фиксирован: {RESTAURANT_ID}</p>
        </header>
        <ReceivingNote />
      </div>
    </div>
  );
}
