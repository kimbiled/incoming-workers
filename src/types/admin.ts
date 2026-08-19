export type AdminEmployee = {
  id: number;
  employee_no: string;
  full_name: string;
  position?: string | null;
  is_active: number;
  created_at: string;
  face_template_count?: number;
};

export type EmployeeImportRow = {
  employee_no: string;
  full_name: string;
  position?: string;
};

export type EmployeeFaceTemplate = {
  id: number;
  created_at: string;
  image_path?: string | null;
  image_url?: string | null;
};
