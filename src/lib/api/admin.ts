import type { AdminEmployee, EmployeeFaceTemplate, EmployeeImportRow } from '@/types/admin';

const API_BASE = '/faceid-api';

export async function fetchEmployees(): Promise<AdminEmployee[]> {
  const res = await fetch(`${API_BASE}/employees`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await formatApiError('Employees', res));
  return res.json();
}

export async function saveEmployee(payload: {
  employee_no: string;
  full_name: string;
  position: string;
}): Promise<AdminEmployee> {
  const res = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await formatApiError('Save employee', res));
  return res.json();
}

export async function updateEmployee(
  employeeId: number,
  payload: {
    employee_no: string;
    full_name: string;
    position: string;
  },
): Promise<AdminEmployee> {
  const res = await fetch(`${API_BASE}/employees/${employeeId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await formatApiError('Update employee', res));
  return res.json();
}

export async function deleteEmployee(employeeId: number) {
  const res = await fetch(`${API_BASE}/employees/${employeeId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await formatApiError('Delete employee', res));
  return res.json();
}

export async function uploadEmployeeFace(employeeId: number, file: File) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const res = await fetch(`${API_BASE}/employees/${employeeId}/face`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(await formatApiError('Upload face', res));
  return res.json();
}

export async function fetchEmployeeFaces(employeeId: number): Promise<EmployeeFaceTemplate[]> {
  const res = await fetch(`${API_BASE}/employees/${employeeId}/faces`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await formatApiError('Employee faces', res));
  const rows = (await res.json()) as EmployeeFaceTemplate[];
  return rows.map((row) => ({
    ...row,
    image_url: row.image_url?.startsWith('/face-template-images/')
      ? `${API_BASE}${row.image_url}`
      : row.image_url,
  }));
}

export async function importEmployees(employees: EmployeeImportRow[]) {
  const res = await fetch(`${API_BASE}/employees/import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ employees }),
  });
  if (!res.ok) throw new Error(await formatApiError('Import employees', res));
  return res.json();
}

export async function syncHikvisionEmployees() {
  const res = await fetch(`${API_BASE}/employees/sync-hikvision`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await formatApiError('Hikvision sync', res));
  return res.json();
}

async function formatApiError(label: string, res: Response) {
  const text = await res.text().catch(() => '');
  return `${label} HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`;
}
