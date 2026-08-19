'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { markFaceAttendance, recognizeFace } from '@/lib/api/faceid';
import { fetchPresence } from '@/lib/api/presence';
import type {
  FaceIdAttendanceRow,
  FaceIdMarkAction,
  FaceIdMarkResult,
  FaceIdRecognition,
} from '@/types/faceid';
import type { Presence } from '@/types/presence';

type ScanState = 'starting' | 'scanning' | 'pending' | 'marking' | 'success' | 'warning' | 'error';
type ScanBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const SCAN_INTERVAL_MS = 800;
const PENDING_MONITOR_INTERVAL_MS = 300;
const MESSAGE_TIMEOUT_MS = 2600;
const ABSENT_FRAMES_TO_RESET = 1;
const MIN_PENDING_FACE_AREA = 0.035;
const PENDING_LOCK_MS = 500;
const CAPTURE_MAX_WIDTH = 640;
const CAPTURE_JPEG_QUALITY = 0.68;

export default function FaceIdKiosk({
  onMarked,
  dateParam,
  locationFilter,
  deviceName,
}: {
  onMarked?: () => void;
  dateParam?: string;
  locationFilter?: string | string[] | null;
  deviceName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanningRef = useRef(false);
  const monitoringRef = useRef(false);
  const absentFramesRef = useRef(0);
  const pendingSinceRef = useRef(0);
  const pendingRef = useRef<FaceIdRecognition | null>(null);
  const messageTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<ScanState>('starting');
  const [pending, setPending] = useState<FaceIdRecognition | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [scanBox, setScanBox] = useState<ScanBox | null>(null);
  const [scanTone, setScanTone] = useState<'scanning' | 'error'>('scanning');
  const [message, setMessage] = useState('Запускаем камеру...');
  const [markingAction, setMarkingAction] = useState<FaceIdMarkAction | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(getCameraAccessHelpText());
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });

        if (!alive || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState('scanning');
        setMessage('Сканирование лица...');
      } catch (err: unknown) {
        setState('error');
        setMessage(`Не удалось открыть камеру: ${getErrorMessage(err)}`);
      }
    }

    startCamera();

    return () => {
      alive = false;
      if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (state !== 'scanning') return;

    const timer = window.setInterval(() => {
      void scanFrame();
    }, SCAN_INTERVAL_MS);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (state !== 'pending' && state !== 'warning') return;

    const timer = window.setInterval(() => {
      void monitorPendingPerson();
    }, PENDING_MONITOR_INTERVAL_MS);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const hasOpenShift = Boolean(
    pending?.external_open_shift ||
      (pending?.attendance_status?.arrival_time && !pending?.attendance_status?.leave_time),
  );

  const statusText = useMemo(() => {
    if (pending?.external_presence_rows?.length) {
      const open = pending.external_presence_rows.find((row) => row.arrival_time && !row.leave_time);
      if (open?.arrival_time) {
        return `Есть открытый приход в Tillypad: ${formatTime(open.arrival_time)}`;
      }

      const last = pending.external_presence_rows[pending.external_presence_rows.length - 1];
      if (last?.arrival_time && last.leave_time) {
        return `Последняя смена в Tillypad закрыта: ${formatTime(last.arrival_time)} - ${formatTime(last.leave_time)}`;
      }
    }

    if (!pending?.attendance_status) return 'За сегодня нет отметок';
    const status = pending.attendance_status;
    if (status.arrival_time && status.leave_time) {
      return `Последняя смена закрыта: ${formatTime(status.arrival_time)} - ${formatTime(status.leave_time)}`;
    }
    if (status.arrival_time) {
      return `Есть открытый приход: ${formatTime(status.arrival_time)}`;
    }
    return 'Сегодня открытой смены нет';
  }, [pending]);

  async function enrichRecognitionWithPresence(recognition: FaceIdRecognition): Promise<FaceIdRecognition> {
    if (!recognition.recognized || !recognition.full_name || !dateParam) return recognition;

    try {
      const rows = (await fetchPresence(dateParam)) as Presence[];
      const matchedRows = mapPresenceRowsToAttendance(
        rows.filter(
          (row) =>
            matchesPresenceDate(row.uslp_DateBegin, dateParam) &&
            matchesPresencePerson(row, recognition) &&
            matchesLocation(row.loc_Name, locationFilter),
        ),
        recognition.employee_id ?? 0,
      );
      const openRow = matchedRows.find((row) => row.arrival_time && !row.leave_time);

      return {
        ...recognition,
        external_open_shift: Boolean(openRow),
        external_arrival_time: openRow?.arrival_time ?? null,
        external_presence_rows: matchedRows,
      };
    } catch {
      return recognition;
    }
  }

  function enrichPendingInBackground(recognition: FaceIdRecognition) {
    void enrichRecognitionWithPresence(recognition).then((enriched) => {
      if (!enriched.recognized) return;

      setPending((current) => {
        if (!current || current.employee_id !== enriched.employee_id) return current;

        return {
          ...current,
          attendance_status: enriched.attendance_status,
          attendance_rows: enriched.attendance_rows,
          external_open_shift: enriched.external_open_shift,
          external_arrival_time: enriched.external_arrival_time,
          external_presence_rows: enriched.external_presence_rows,
        };
      });
    });
  }

  async function scanFrame() {
    if (scanningRef.current || state !== 'scanning') return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    scanningRef.current = true;
    try {
      sizeCaptureCanvas(canvas, video);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas);
      const recognition = await recognizeFace(blob);
      const nextBox = bboxToScanBox(recognition.bbox, video, canvas.width, canvas.height);
      setScanBox(nextBox);

      if (recognition.recognized) {
        absentFramesRef.current = 0;
        pendingSinceRef.current = Date.now();
        setPending(recognition);
        setSnapshotUrl(canvas.toDataURL('image/jpeg', CAPTURE_JPEG_QUALITY));
        setState('pending');
        setMessage('Сделать приход или уход?');
        enrichPendingInBackground(recognition);
        return;
      }

      showScannerMessage(
        recognition.reason === 'no_face' ? 'Лицо не найдено' : 'Не получилось распознать лицо',
        'error',
      );
    } catch (err: unknown) {
      showScannerMessage(getErrorMessage(err), 'error');
    } finally {
      scanningRef.current = false;
    }
  }

  async function monitorPendingPerson() {
    const currentPending = pendingRef.current;
    if (!currentPending || monitoringRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    monitoringRef.current = true;
    try {
      sizeCaptureCanvas(canvas, video);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas);
      const recognition = await recognizeFace(blob);
      const nextBox = bboxToScanBox(recognition.bbox, video, canvas.width, canvas.height);
      setScanBox(nextBox);
      const samePerson =
        recognition.recognized &&
        recognition.employee_id === currentPending.employee_id &&
        isFaceStillInFrame(nextBox);

      if (samePerson) {
        absentFramesRef.current = 0;
        setPending((prev) =>
          prev
            ? {
                ...prev,
                attendance_status: recognition.attendance_status,
                attendance_rows: recognition.attendance_rows,
              }
            : prev,
        );
        return;
      }

      absentFramesRef.current += 1;
      if (canAutoClosePending() && absentFramesRef.current >= ABSENT_FRAMES_TO_RESET) {
        resumeScanning();
      }
    } catch {
      absentFramesRef.current += 1;
      if (canAutoClosePending() && absentFramesRef.current >= ABSENT_FRAMES_TO_RESET) {
        resumeScanning();
      }
    } finally {
      monitoringRef.current = false;
    }
  }

  async function mark(action: FaceIdMarkAction) {
    if (!pending || markingAction) return;

    try {
      setMarkingAction(action);
      setState('marking');
      setMessage(`${action === 'arrival' ? 'Приход' : 'Уход'} проводится...`);
      const result = await markFaceAttendance(pending, action, deviceName || primaryLocationName(locationFilter));
      showMarkResult(action, result);
      if (result.success) {
        applySuccessfulMark(action, result);
        onMarked?.();
        if (dateParam) {
          void fetchPresence(dateParam).catch(() => null);
        }
      }
    } catch (err: unknown) {
      setState('error');
      setMessage(getErrorMessage(err));
    } finally {
      setMarkingAction(null);
    }
  }

  function applySuccessfulMark(action: FaceIdMarkAction, result: FaceIdMarkResult) {
    const markTime = result.time ?? new Date().toISOString();

    setPending((current) => {
      if (!current?.employee_id) return current;

      const localRows = updateRowsAfterMark(
        current.attendance_rows ?? [],
        current.employee_id,
        action,
        markTime,
      );
      const externalRows = current.external_presence_rows?.length
        ? updateRowsAfterMark(current.external_presence_rows, current.employee_id, action, markTime)
        : current.external_presence_rows;
      const latest = localRows[localRows.length - 1] ?? null;

      return {
        ...current,
        attendance_status: latest,
        attendance_rows: localRows,
        external_open_shift:
          action === 'arrival'
            ? true
            : Boolean(externalRows?.some((row) => row.arrival_time && !row.leave_time)),
        external_arrival_time:
          action === 'arrival'
            ? markTime
            : externalRows?.find((row) => row.arrival_time && !row.leave_time)?.arrival_time ?? null,
        external_presence_rows: externalRows,
      };
    });
  }

  function showMarkResult(action: FaceIdMarkAction, result: FaceIdMarkResult) {
    if (result.success) {
      const isRepeat = countTodayActions(pending?.attendance_rows ?? [], action) > 0;
      setState('success');
      setMessage(
        `${isRepeat ? 'Повторный ' : ''}${action === 'arrival' ? 'приход' : 'уход'} успешно зафиксирован: ${formatTime(result.time)}`,
      );
      window.setTimeout(resumeScanning, MESSAGE_TIMEOUT_MS);
      return;
    }

    setState('warning');
    if (result.event_type === 'open_shift_exists') {
      setMessage(`Приход уже есть: ${formatTime(result.arrival_time)}`);
    } else if (result.event_type === 'open_shift_missing') {
      setMessage('Нет открытого прихода. Сначала сделайте приход.');
    } else {
      setMessage(result.message || 'Отметка не записана');
    }
  }

  function resumeScanning() {
    absentFramesRef.current = 0;
    pendingSinceRef.current = 0;
    pendingRef.current = null;
    setPending(null);
    setSnapshotUrl(null);
    setMarkingAction(null);
    setState('scanning');
    setScanTone('scanning');
    setMessage('Сканирование лица...');
  }

  function canAutoClosePending() {
    return !pendingSinceRef.current || Date.now() - pendingSinceRef.current > PENDING_LOCK_MS;
  }

  function showScannerMessage(text: string, tone: 'scanning' | 'error') {
    setScanTone(tone);
    setMessage(text);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => {
      setScanTone('scanning');
      setMessage('Сканирование лица...');
    }, 1400);
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="relative min-h-[360px] bg-gray-950 sm:aspect-video sm:min-h-0 portrait:aspect-auto portrait:min-h-[50vh]">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {pending ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-4">
            <div
              className={[
                'pointer-events-auto relative max-h-[calc(100%-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border p-4 pt-14 text-center shadow-2xl backdrop-blur sm:p-5 sm:pt-14',
                panelClass(state, hasOpenShift),
              ].join(' ')}
            >
              <button
                type="button"
                onClick={resumeScanning}
                className="absolute right-3 top-3 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-white"
              >
                Выйти
              </button>

              {snapshotUrl && (
                <img
                  src={snapshotUrl}
                  alt=""
                  className="mx-auto mb-3 h-24 w-24 rounded-full object-cover ring-4 ring-white/80 sm:h-32 sm:w-32"
                />
              )}

              <>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">{pending.full_name}</h2>
                <p className="mt-2 text-sm font-semibold opacity-80">{statusText}</p>
                <AttendanceRows
                  rows={
                    pending.external_presence_rows?.length
                      ? pending.external_presence_rows
                      : (pending.attendance_rows ?? [])
                  }
                />
                <p className="mt-3 text-base font-semibold">{message}</p>

                {state === 'marking' && (
                  <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-semibold">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>
                      {markingAction === 'leave' ? 'Проводим уход...' : 'Проводим приход...'}
                    </span>
                  </div>
                )}

                {(state === 'pending' || state === 'warning' || state === 'marking') && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => mark('arrival')}
                      disabled={state === 'marking'}
                      className={[
                        'rounded-xl px-5 py-3 text-sm font-semibold text-white',
                        state === 'marking'
                          ? 'cursor-wait bg-emerald-400 opacity-70'
                          : 'bg-emerald-600 hover:bg-emerald-700',
                      ].join(' ')}
                    >
                      Сделать приход
                    </button>
                    <button
                      onClick={() => mark('leave')}
                      disabled={state === 'marking'}
                      className={[
                        'rounded-xl px-5 py-3 text-sm font-semibold text-white',
                        state === 'marking'
                          ? 'cursor-wait bg-sky-400 opacity-70'
                          : 'bg-sky-600 hover:bg-sky-700',
                      ].join(' ')}
                    >
                      Сделать уход
                    </button>
                  </div>
                )}
              </>
            </div>
          </div>
        ) : (
          <ScannerOverlay box={scanBox} message={message} tone={scanTone} />
        )}
      </div>
    </section>
  );
}

function primaryLocationName(locationFilter?: string | string[] | null) {
  if (Array.isArray(locationFilter)) return locationFilter[0] || 'FaceID';
  return locationFilter || 'FaceID';
}

function AttendanceRows({ rows }: { rows: FaceIdAttendanceRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white/70 text-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-white/70 text-xs uppercase tracking-wide opacity-70">
            <th className="border-b border-black/10 px-2 py-2">Приход</th>
            <th className="border-b border-black/10 px-2 py-2">Уход</th>
            <th className="border-b border-black/10 px-2 py-2">Итого</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={attendanceRowKey(row, index)}>
              <td className="border-t border-black/5 px-2 py-2 font-semibold">
                {formatTime(row.arrival_time)}
              </td>
              <td className="border-t border-black/5 px-2 py-2">
                {row.leave_time ? formatTime(row.leave_time) : 'На смене'}
              </td>
              <td className="border-t border-black/5 px-2 py-2 font-semibold">
                {row.arrival_time && row.leave_time
                  ? durationHHmm(row.arrival_time, row.leave_time)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function mapPresenceRowsToAttendance(rows: Presence[], employeeId: number): FaceIdAttendanceRow[] {
  return [...rows]
    .sort(
      (a, b) =>
        new Date(a.uslp_DateBegin).valueOf() -
        new Date(b.uslp_DateBegin).valueOf(),
    )
    .map((row, index) => ({
      id: -index - 1,
      employee_id: employeeId,
      work_date: row.uslp_DateBegin.slice(0, 10),
      arrival_time: row.uslp_DateBegin,
      leave_time: row.uslp_DateEnd ?? null,
      status: row.uslp_DateEnd ? 'closed_tillypad' : 'open_tillypad',
      comment: 'Tillypad',
    }));
}

function updateRowsAfterMark(
  rows: FaceIdAttendanceRow[],
  employeeId: number,
  action: FaceIdMarkAction,
  markTime: string,
) {
  if (action === 'arrival') {
    if (rows.some((row) => sameMarkTime(row.arrival_time, markTime))) {
      return rows;
    }

    return [
      ...rows,
      {
        id: makeLocalAttendanceId(employeeId, action, markTime, rows.length),
        employee_id: employeeId,
        work_date: markTime.slice(0, 10),
        arrival_time: markTime,
        leave_time: null,
        status: 'open',
        comment: 'FaceID',
      },
    ];
  }

  if (rows.some((row) => sameMarkTime(row.leave_time, markTime))) {
    return rows;
  }

  const openIndex = rows.findIndex((row) => row.arrival_time && !row.leave_time);

  if (openIndex >= 0) {
    return rows.map((row, index) =>
      index === openIndex
        ? {
            ...row,
            leave_time: markTime,
            status: 'closed',
          }
        : row,
    );
  }

  return [
    ...rows,
    {
      id: makeLocalAttendanceId(employeeId, action, markTime, rows.length),
      employee_id: employeeId,
      work_date: markTime.slice(0, 10),
      arrival_time: null,
      leave_time: markTime,
      status: 'closed',
      comment: 'FaceID',
    },
  ];
}

function sameMarkTime(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  const leftTime = new Date(left).valueOf();
  const rightTime = new Date(right).valueOf();

  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
    return Math.abs(leftTime - rightTime) < 1000;
  }

  return left === right;
}

function attendanceRowKey(row: FaceIdAttendanceRow, index: number) {
  return [
    row.id,
    row.employee_id,
    row.work_date,
    row.arrival_time ?? 'no-arrival',
    row.leave_time ?? 'no-leave',
    index,
  ].join('|');
}

function makeLocalAttendanceId(
  employeeId: number,
  action: FaceIdMarkAction,
  markTime: string,
  rowCount: number,
) {
  const value = `${employeeId}|${action}|${markTime}|${rowCount}`;
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return hash || -1;
}

function matchesPersonName(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  return wildcardNameMatches(normalizedLeft, normalizedRight) || wildcardNameMatches(normalizedRight, normalizedLeft);
}

function matchesPresencePerson(row: Presence, recognition: FaceIdRecognition) {
  if (row.usr_ID?.startsWith('faceid-') && recognition.employee_no) {
    return row.usrr_ID === `faceid-role-${recognition.employee_no}`;
  }

  return matchesPersonName(row.usr_Name, recognition.full_name);
}

function matchesLocation(value: string | null | undefined, filter: string | string[] | null | undefined) {
  if (!filter) return true;
  const filters = Array.isArray(filter) ? filter : [filter];
  const normalizedValue = normalizeText(value);
  return filters.some((item) => normalizeText(item) === normalizedValue);
}

function matchesPresenceDate(value: string | null | undefined, dateParam: string) {
  if (!value) return false;
  const [dd, mm, yyyy] = dateParam.split('.');
  if (!dd || !mm || !yyyy) return true;
  return value.slice(0, 10) === `${yyyy}-${mm}-${dd}`;
}

function normalizeText(value?: string | null) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function wildcardNameMatches(pattern: string, value: string) {
  if (!pattern.includes('?')) return false;
  const escaped = pattern
    .split('')
    .map((char) => (char === '?' ? '.' : escapeRegExp(char)))
    .join('');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ScannerOverlay({
  box,
  message,
  tone,
}: {
  box: ScanBox | null;
  message: string;
  tone: 'scanning' | 'error';
}) {
  const isError = tone === 'error';

  return (
    <div className="pointer-events-none absolute inset-0">
      {box && (
        <div
          className="face-scan-box absolute"
          style={{
            left: `${box.left}%`,
            top: `${box.top}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
          }}
        >
          <div
            className={[
              'absolute inset-0 rounded-3xl border-2',
              isError ? 'border-red-400/90 shadow-[0_0_28px_rgba(248,113,113,0.45)]' : 'border-emerald-300/90 shadow-[0_0_28px_rgba(110,231,183,0.55)]',
            ].join(' ')}
          />
          <div className="face-scan-corner absolute -left-2 -top-2 h-12 w-12 rounded-tl-3xl border-l-4 border-t-4 border-white" />
          <div className="face-scan-corner absolute -right-2 -top-2 h-12 w-12 rounded-tr-3xl border-r-4 border-t-4 border-white" />
          <div className="face-scan-corner absolute -bottom-2 -left-2 h-12 w-12 rounded-bl-3xl border-b-4 border-l-4 border-white" />
          <div className="face-scan-corner absolute -bottom-2 -right-2 h-12 w-12 rounded-br-3xl border-b-4 border-r-4 border-white" />
          {!isError && (
            <>
              <div className="face-scan-line absolute left-3 right-3 h-0.5 bg-emerald-300/95 shadow-[0_0_18px_rgba(110,231,183,0.95)]" />
              <div className="face-scan-grid absolute inset-3 rounded-2xl" />
            </>
          )}
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
        <div
          className={[
            'rounded-full px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur',
            isError
              ? 'bg-red-50/95 text-red-800 ring-1 ring-red-200'
              : 'bg-gray-950/70 text-white ring-1 ring-white/20',
          ].join(' ')}
        >
          {message}
        </div>
      </div>
    </div>
  );
}

function bboxToScanBox(
  bbox: FaceIdRecognition['bbox'],
  video: HTMLVideoElement,
  imageWidth: number,
  imageHeight: number,
): ScanBox | null {
  if (!bbox || bbox.length < 4 || imageWidth <= 0 || imageHeight <= 0) return null;

  const [x1, y1, x2, y2] = bbox;
  const paddingX = Math.max((x2 - x1) * 0.08, 12);
  const paddingY = Math.max((y2 - y1) * 0.12, 16);
  const videoWidth = video.clientWidth || imageWidth;
  const videoHeight = video.clientHeight || imageHeight;
  const scale = Math.max(videoWidth / imageWidth, videoHeight / imageHeight);
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  const offsetX = (videoWidth - renderedWidth) / 2;
  const offsetY = (videoHeight - renderedHeight) / 2;

  const leftPx = offsetX + (x1 - paddingX) * scale;
  const topPx = offsetY + (y1 - paddingY) * scale;
  const rightPx = offsetX + (x2 + paddingX) * scale;
  const bottomPx = offsetY + (y2 + paddingY) * scale;

  const left = clamp((leftPx / videoWidth) * 100, 0, 100);
  const top = clamp((topPx / videoHeight) * 100, 0, 100);
  const right = clamp((rightPx / videoWidth) * 100, 0, 100);
  const bottom = clamp((bottomPx / videoHeight) * 100, 0, 100);

  return {
    left,
    top,
    width: Math.max(right - left, 8),
    height: Math.max(bottom - top, 10),
  };
}

function isFaceStillInFrame(box: ScanBox | null) {
  if (!box) return false;
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  const area = (box.width / 100) * (box.height / 100);

  return (
    area >= MIN_PENDING_FACE_AREA &&
    centerX >= 12 &&
    centerX <= 88 &&
    centerY >= 10 &&
    centerY <= 90
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function panelClass(state: ScanState, hasOpenShift: boolean) {
  if (state === 'success') return 'border-emerald-200 bg-emerald-50/95 text-emerald-950';
  if (state === 'warning') return 'border-amber-200 bg-amber-50/95 text-amber-950';
  if (state === 'error') return 'border-red-200 bg-red-50/95 text-red-950';
  if (hasOpenShift) return 'border-sky-200 bg-sky-50/95 text-sky-950';
  return 'border-white/40 bg-white/95 text-gray-950';
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Не удалось создать снимок'));
      },
      'image/jpeg',
      CAPTURE_JPEG_QUALITY,
    );
  });
}

function sizeCaptureCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;
  const scale = Math.min(1, CAPTURE_MAX_WIDTH / sourceWidth);

  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function durationHHmm(begin: string, end: string) {
  const start = new Date(begin).valueOf();
  const finish = new Date(end).valueOf();
  if (Number.isNaN(start) || Number.isNaN(finish) || finish < start) return '—';
  const totalMinutes = Math.floor((finish - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function countTodayActions(rows: FaceIdAttendanceRow[], action: FaceIdMarkAction) {
  if (action === 'arrival') return rows.filter((row) => row.arrival_time).length;
  return rows.filter((row) => row.leave_time).length;
}

function getErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return 'Нет связи с FaceID-сервером. Проверьте локальную сеть и перезапустите страницу.';
  }

  return message;
}

function getCameraAccessHelpText() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'текущий адрес сайта';
  return `Браузер не даёт доступ к камере для HTTP. Откройте сайт через HTTPS или добавьте ${origin} в chrome://flags/#unsafely-treat-insecure-origin-as-secure`;
}
