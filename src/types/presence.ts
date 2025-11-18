export type Presence = {
  usr_ID: string;
  usr_Name: string;

  usrr_ID?: string | null;
  usrr_Name?: string | null;

  loc_ID?: string;
  loc_Name?: string;

  uslp_DateBegin: string;
  uslp_DateEnd?: string | null;
};
