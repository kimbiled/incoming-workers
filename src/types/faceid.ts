export type FaceIdAttendanceStatus = {
  id: number;
  employee_id: number;
  work_date: string;
  arrival_time?: string | null;
  leave_time?: string | null;
  status?: string | null;
  comment?: string | null;
} | null;

export type FaceIdAttendanceRow = {
  id: number;
  employee_id: number;
  work_date: string;
  arrival_time?: string | null;
  leave_time?: string | null;
  status?: string | null;
  comment?: string | null;
};

export type FaceIdRecognition = {
  recognized: boolean;
  reason?: string;
  message?: string;
  employee_id?: number;
  employee_no?: string;
  full_name?: string;
  position?: string;
  similarity?: number;
  bbox?: [number, number, number, number] | number[] | null;
  image_path?: string | null;
  attendance_status?: FaceIdAttendanceStatus;
  attendance_rows?: FaceIdAttendanceRow[];
  external_open_shift?: boolean;
  external_arrival_time?: string | null;
  external_presence_rows?: FaceIdAttendanceRow[];
};

export type FaceIdMarkAction = 'arrival' | 'leave';

export type FaceIdMarkResult = {
  success: boolean;
  event_type: string;
  time?: string;
  message?: string;
  arrival_time?: string | null;
  leave_time?: string | null;
  webhook?: unknown;
};
