import type { FaceIdMarkAction, FaceIdMarkResult, FaceIdRecognition } from '@/types/faceid';

export async function recognizeFace(frame: Blob): Promise<FaceIdRecognition> {
  const formData = new FormData();
  formData.append('file', frame, 'frame.jpg');

  const res = await fetch('/faceid-api/face/recognize', {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`FaceID recognize HTTP ${res.status}`);
  return res.json();
}

export async function markFaceAttendance(
  recognition: FaceIdRecognition,
  action: FaceIdMarkAction,
  cameraName = 'web_front',
): Promise<FaceIdMarkResult> {
  const res = await fetch('/faceid-api/attendance/mark', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      employee_id: recognition.employee_id,
      employee_no: recognition.employee_no,
      full_name: recognition.full_name,
      position: recognition.position,
      similarity: recognition.similarity ?? 0,
      image_path: recognition.image_path,
      action,
      camera_name: cameraName,
      external_open_shift: recognition.external_open_shift ?? false,
      external_arrival_time: recognition.external_arrival_time ?? null,
    }),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`FaceID mark HTTP ${res.status}`);
  return res.json();
}
