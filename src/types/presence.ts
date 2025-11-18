export type Presence = {
  usr_ID: string;
  usr_Name: string; // ФИО
  loc_ID?: string;
  loc_Name?: string;
  uslp_DateBegin: string; // ISO
  uslp_DateEnd?: string | null; // ISO | null
};
