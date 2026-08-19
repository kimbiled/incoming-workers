'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteEmployee,
  fetchEmployeeFaces,
  fetchEmployees,
  importEmployees,
  saveEmployee,
  syncHikvisionEmployees,
  updateEmployee,
  uploadEmployeeFace,
} from '@/lib/api/admin';
import type { AdminEmployee, EmployeeFaceTemplate, EmployeeImportRow } from '@/types/admin';

const SAMPLE_IMPORT = `700519399116;Аширов Фазыл;Официант
930322303118;Тургуналиев Наурызбек;Повар
990314350692;Аусатов Темирлан;Менеджер`;

type EmployeeSortKey = 'id' | 'employee_no' | 'full_name' | 'position' | 'face_template_count';
type EmployeeSort = {
  key: EmployeeSortKey;
  direction: 'asc' | 'desc';
} | null;

export default function AdminPanel() {
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [employeeModalMode, setEmployeeModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<AdminEmployee | null>(null);
  const [editEmployeeNo, setEditEmployeeNo] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editFaceFile, setEditFaceFile] = useState<File | null>(null);
  const [editFaces, setEditFaces] = useState<EmployeeFaceTemplate[]>([]);
  const [editFacesLoading, setEditFacesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [editCameraActive, setEditCameraActive] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [employeeSort, setEmployeeSort] = useState<EmployeeSort>(null);
  const [importText, setImportText] = useState(SAMPLE_IMPORT);
  const editVideoRef = useRef<HTMLVideoElement | null>(null);
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editStreamRef = useRef<MediaStream | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchEmployees();
      setEmployees(rows);
      setSelectedEmployeeId((current) => current ?? rows[0]?.id ?? null);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    return () => {
      stopEditCamera();
    };
  }, []);

  const sortedEmployees = useMemo(() => {
    if (!employeeSort) return employees;

    return [...employees].sort((a, b) => {
      const direction = employeeSort.direction === 'asc' ? 1 : -1;
      const result = compareEmployees(a, b, employeeSort.key);
      return result * direction || b.id - a.id;
    });
  }, [employees, employeeSort]);

  function toggleEmployeeSort(key: EmployeeSortKey) {
    setEmployeeSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }

  function openCreateModal() {
    setEmployeeModalMode('create');
    setEditingEmployee(null);
    setEditEmployeeNo('');
    setEditFullName('');
    setEditPosition('');
    setEditFaceFile(null);
    setEditFaces([]);
    setMessage('');
    setError('');
  }

  function openEditModal(employee: AdminEmployee) {
    setEmployeeModalMode('edit');
    setEditingEmployee(employee);
    setEditEmployeeNo(employee.employee_no);
    setEditFullName(employee.full_name);
    setEditPosition(employee.position ?? '');
    setEditFaceFile(null);
    setEditFaces([]);
    setMessage('');
    setError('');
    void loadEmployeeFaces(employee.id);
  }

  function closeEmployeeModal() {
    stopEditCamera();
    setEmployeeModalMode(null);
    setEditingEmployee(null);
    setEditEmployeeNo('');
    setEditFullName('');
    setEditPosition('');
    setEditFaceFile(null);
    setEditFaces([]);
  }

  async function loadEmployeeFaces(employeeId: number) {
    setEditFacesLoading(true);
    try {
      setEditFaces(await fetchEmployeeFaces(employeeId));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setEditFacesLoading(false);
    }
  }

  async function handleSaveEmployeeModal(event: React.FormEvent) {
    event.preventDefault();
    if (!employeeModalMode) return;

    setMessage('');
    setError('');
    try {
      const payload = {
        employee_no: editEmployeeNo,
        full_name: editFullName,
        position: editPosition,
      };
      const employee =
        employeeModalMode === 'edit' && editingEmployee
          ? await updateEmployee(editingEmployee.id, payload)
          : await saveEmployee(payload);

      if (editFaceFile) {
        const faceResult = await uploadEmployeeFace(employee.id, editFaceFile);
        if (!faceResult.success) {
          setError(faceResult.message || 'Данные сохранены, но фото лица не добавлено');
          await loadEmployees();
          return;
        }
      }

      const actionText = employeeModalMode === 'edit' ? 'обновлены' : 'сохранены';
      setMessage(
        editFaceFile
          ? `Данные и фото ${actionText}: ${employee.full_name}`
          : `Данные ${actionText}: ${employee.full_name}`,
      );
      if (editFaceFile) {
        await loadEmployeeFaces(employee.id);
      }
      closeEmployeeModal();
      await loadEmployees();
      setSelectedEmployeeId(employee.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }

  async function startEditCamera() {
    setError('');
    setMessage('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(getCameraAccessHelpText());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      });
      editStreamRef.current = stream;
      setEditCameraActive(true);
      if (editVideoRef.current) {
        editVideoRef.current.srcObject = stream;
        await editVideoRef.current.play();
      }
    } catch (err: unknown) {
      setError(`Не удалось открыть камеру: ${getErrorMessage(err)}`);
    }
  }

  function stopEditCamera() {
    editStreamRef.current?.getTracks().forEach((track) => track.stop());
    editStreamRef.current = null;
    setEditCameraActive(false);
  }

  async function handleDeleteEmployee(employee: AdminEmployee) {
    const confirmed = window.confirm(`Удалить сотрудника "${employee.full_name}" из Face ID?`);
    if (!confirmed) return;

    setMessage('');
    setError('');
    try {
      await deleteEmployee(employee.id);
      setMessage(`Сотрудник удалён: ${employee.full_name}`);
      if (selectedEmployeeId === employee.id) setSelectedEmployeeId(null);
      await loadEmployees();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }

  async function captureEditFace() {
    setMessage('');
    setError('');

    const video = editVideoRef.current;
    const canvas = editCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      setError('Камера ещё не готова');
      return;
    }

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Не удалось сделать снимок');
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], `face-edit-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });

    setEditFaceFile(file);
    setMessage('Снимок готов. Сохраните изменения, чтобы обновить фото сотрудника.');
  }

  async function handleImport() {
    setMessage('');
    setError('');
    const rows = parseImportRows(importText);
    if (rows.length === 0) {
      setError('Нет строк для импорта');
      return;
    }

    try {
      const result = await importEmployees(rows);
      setMessage(`Импортировано сотрудников: ${result.count}`);
      await loadEmployees();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }

  async function handleHikvisionSync() {
    setMessage('');
    setError('');
    setSyncLoading(true);
    try {
      const result = await syncHikvisionEmployees();
      setMessage(
        `Hikvision: импортировано ${result.imported_count ?? 0}, фото добавлено ${result.faces_added ?? 0}`,
      );
      await loadEmployees();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSyncLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-950">Админ панель Face ID</h1>
            <p className="text-sm text-gray-500">Сотрудники, фото лиц и импорт из Tillypad-выгрузки</p>
          </div>
          <Link href="/" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
            К табелю
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[360px_1fr]">
        <section className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Импорт сотрудников</h2>
            <p className="mb-3 text-sm text-gray-500">
              Основной импорт можно делать из Hikvision. Ручной список ниже оставлен как запасной вариант.
            </p>
            <button
              onClick={handleHikvisionSync}
              disabled={syncLoading}
              className="mb-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {syncLoading ? 'Синхронизация...' : 'Синхронизировать с Hikvision'}
            </button>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              className="h-40 w-full rounded-xl border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleImport}
              className="mt-3 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
            >
              Импортировать список
            </button>
          </section>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Сотрудники Face ID</h2>
            <div className="flex gap-2">
              <button
                onClick={openCreateModal}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Добавить сотрудника
              </button>
              <button
                onClick={() => loadEmployees()}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Обновить
              </button>
            </div>
          </div>

          {(message || error) && (
            <div
              className={[
                'mb-4 rounded-xl border px-3 py-2 text-sm',
                error
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              ].join(' ')}
            >
              {error || message}
            </div>
          )}

          <div className="overflow-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <SortableEmployeeTh sortKey="id" sort={employeeSort} onSort={toggleEmployeeSort}>
                    ID
                  </SortableEmployeeTh>
                  <SortableEmployeeTh sortKey="employee_no" sort={employeeSort} onSort={toggleEmployeeSort}>
                    Номер
                  </SortableEmployeeTh>
                  <SortableEmployeeTh sortKey="full_name" sort={employeeSort} onSort={toggleEmployeeSort}>
                    ФИО
                  </SortableEmployeeTh>
                  <SortableEmployeeTh sortKey="position" sort={employeeSort} onSort={toggleEmployeeSort}>
                    Должность
                  </SortableEmployeeTh>
                  <SortableEmployeeTh sortKey="face_template_count" sort={employeeSort} onSort={toggleEmployeeSort}>
                    Фото
                  </SortableEmployeeTh>
                  <th className="px-3 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => setSelectedEmployeeId(employee.id)}
                    className={[
                      'cursor-pointer hover:bg-gray-50',
                      selectedEmployeeId === employee.id ? 'bg-blue-50' : '',
                    ].join(' ')}
                  >
                    <td className="px-3 py-3">{employee.id}</td>
                    <td className="px-3 py-3 font-mono">{employee.employee_no}</td>
                    <td className="px-3 py-3 font-semibold">{employee.full_name}</td>
                    <td className="px-3 py-3">{employee.position || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                        {employee.face_template_count ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(employee);
                          }}
                          className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteEmployee(employee);
                          }}
                          className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && employees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                      Сотрудников пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {employeeModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={handleSaveEmployeeModal}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">
                  {employeeModalMode === 'edit' ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
                </h2>
                {editingEmployee && <p className="text-sm text-gray-500">ID: {editingEmployee.id}</p>}
              </div>
              <button
                type="button"
                onClick={closeEmployeeModal}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>

            <Field label="Номер сотрудника / ИИН">
              <input
                value={editEmployeeNo}
                onChange={(event) => setEditEmployeeNo(event.target.value)}
                required
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="ФИО">
              <input
                value={editFullName}
                onChange={(event) => setEditFullName(event.target.value)}
                required
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <Field label="Должность">
              <input
                value={editPosition}
                onChange={(event) => setEditPosition(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <div className="my-5 h-px bg-gray-200" />

            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-950">Фото лица</h3>
                <p className="text-sm text-gray-500">
                  {editingEmployee
                    ? `Сейчас шаблонов: ${editingEmployee.face_template_count ?? 0}`
                    : 'Можно добавить фото сразу при создании'}
                </p>
              </div>
            </div>
            {employeeModalMode === 'edit' && (
              <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                {editFacesLoading ? (
                  <p className="text-sm text-gray-500">Загружаю фото...</p>
                ) : editFaces.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {editFaces.map((face) => (
                      <div key={face.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                        {face.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={face.image_url}
                            alt={`Face template ${face.id}`}
                            className="aspect-square w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center px-2 text-center text-xs text-gray-400">
                            Фото не сохранено
                          </div>
                        )}
                        <div className="px-2 py-1 text-xs font-semibold text-gray-600">#{face.id}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Фото лица пока нет</p>
                )}
              </div>
            )}
            <Field label="Новое фото">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setEditFaceFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              {editFaceFile && (
                <span className="mt-1 block text-xs font-medium text-emerald-700">
                  Выбрано: {editFaceFile.name}
                </span>
              )}
            </Field>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-semibold uppercase text-gray-400">или</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950">
              <video
                ref={editVideoRef}
                className="aspect-video w-full object-cover"
                muted
                playsInline
              />
              <canvas ref={editCanvasRef} className="hidden" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {editCameraActive ? (
                <button
                  type="button"
                  onClick={stopEditCamera}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                >
                  Закрыть камеру
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startEditCamera}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                >
                  Открыть камеру
                </button>
              )}
              <button
                type="button"
                onClick={captureEditFace}
                disabled={!editCameraActive}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Сделать фото
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEmployeeModal}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
              >
                Отмена
              </button>
              <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                {employeeModalMode === 'edit'
                  ? editFaceFile
                    ? 'Сохранить изменения и фото'
                    : 'Сохранить изменения'
                  : editFaceFile
                    ? 'Создать сотрудника и фото'
                    : 'Создать сотрудника'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function SortableEmployeeTh({
  children,
  sortKey,
  sort,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: EmployeeSortKey;
  sort: EmployeeSort;
  onSort: (key: EmployeeSortKey) => void;
}) {
  const active = sort?.key === sortKey;

  return (
    <th className="px-3 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-semibold hover:text-gray-900"
      >
        {children}
        <span className={active ? 'text-gray-900' : 'text-gray-400'}>
          {active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

function compareEmployees(a: AdminEmployee, b: AdminEmployee, key: EmployeeSortKey) {
  if (key === 'id') return a.id - b.id;
  if (key === 'face_template_count') {
    return (a.face_template_count ?? 0) - (b.face_template_count ?? 0);
  }

  const left = getEmployeeSortText(a, key);
  const right = getEmployeeSortText(b, key);
  return left.localeCompare(right, 'ru', {
    numeric: true,
    sensitivity: 'base',
  });
}

function getEmployeeSortText(employee: AdminEmployee, key: EmployeeSortKey) {
  if (key === 'employee_no') return employee.employee_no || '';
  if (key === 'full_name') return employee.full_name || '';
  if (key === 'position') return employee.position || '';
  return '';
}

function parseImportRows(text: string): EmployeeImportRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;\t,]/).map((part) => part.trim());
      return {
        employee_no: parts[0] ?? '',
        full_name: parts[1] ?? '',
        position: parts[2] ?? '',
      };
    })
    .filter((row) => row.employee_no && row.full_name);
}

function getErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return 'Нет связи с FaceID-сервером. Проверьте локальную сеть и запущен ли backend.';
  }

  return message;
}

function getCameraAccessHelpText() {
  return 'Браузер не даёт доступ к камере для HTTP. Откройте сайт через HTTPS или в Chrome добавьте http://10.10.6.128:3000 в chrome://flags/#unsafely-treat-insecure-origin-as-secure';
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Не удалось создать снимок'));
      },
      'image/jpeg',
      0.9,
    );
  });
}
