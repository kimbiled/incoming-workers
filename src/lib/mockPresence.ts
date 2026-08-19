import type { Presence } from '@/types/presence';

type MockPerson = {
  usr_ID: string;
  usr_Name: string;
  usrr_ID: string;
  usrr_Name: string;
  loc_ID: string;
  loc_Name: string;
  shifts: Array<{
    begin: string;
    end: string | null;
  }>;
};

const PEOPLE: MockPerson[] = [
  {
    usr_ID: 'mock-001',
    usr_Name: 'Аширов Фазыл',
    usrr_ID: 'role-waiter',
    usrr_Name: 'Официант',
    loc_ID: 'loc-farhi',
    loc_Name: 'Farhi',
    shifts: [
      { begin: '09:05:12', end: '13:22:41' },
      { begin: '14:02:18', end: '18:10:44' },
      { begin: '18:36:05', end: null },
    ],
  },
  {
    usr_ID: 'mock-002',
    usr_Name: 'Тургуналиев Наурызбек',
    usrr_ID: 'role-cook',
    usrr_Name: 'Повар',
    loc_ID: 'loc-farhi',
    loc_Name: 'Farhi',
    shifts: [
      { begin: '08:42:33', end: '12:18:09' },
      { begin: '12:47:51', end: null },
    ],
  },
  {
    usr_ID: 'mock-003',
    usr_Name: 'Досмагамбетова Дария',
    usrr_ID: 'role-waiter',
    usrr_Name: 'Официант',
    loc_ID: 'loc-sharzhum',
    loc_Name: 'SharZhum',
    shifts: [
      { begin: '11:31:27', end: '15:05:10' },
      { begin: '15:32:44', end: '20:40:54' },
    ],
  },
  {
    usr_ID: 'mock-004',
    usr_Name: 'Темирханов Олжас',
    usrr_ID: 'role-manager',
    usrr_Name: 'Менеджер',
    loc_ID: 'loc-farhi',
    loc_Name: 'Farhi',
    shifts: [
      { begin: '10:30:42', end: '14:20:00' },
      { begin: '15:04:17', end: null },
    ],
  },
  {
    usr_ID: 'mock-005',
    usr_Name: 'Байтулеева Индира',
    usrr_ID: 'role-cashier',
    usrr_Name: 'Кассир',
    loc_ID: 'loc-farhi',
    loc_Name: 'Farhi',
    shifts: [
      { begin: '09:19:15', end: '13:01:02' },
      { begin: '13:45:33', end: '17:36:20' },
      { begin: '18:08:04', end: '22:56:49' },
    ],
  },
  {
    usr_ID: 'mock-006',
    usr_Name: 'Касенов Ниязбек Ибишевич',
    usrr_ID: 'role-security',
    usrr_Name: 'Охранник',
    loc_ID: 'loc-office',
    loc_Name: 'Office',
    shifts: [
      { begin: '08:28:10', end: '12:00:00' },
      { begin: '12:34:22', end: null },
    ],
  },
  {
    usr_ID: 'mock-007',
    usr_Name: 'Суинова Арайлым',
    usrr_ID: 'role-senior-waiter',
    usrr_Name: 'Старший официант',
    loc_ID: 'loc-farhi-hall',
    loc_Name: 'Farhi Hall',
    shifts: [
      { begin: '10:02:11', end: '14:15:47' },
      { begin: '14:44:08', end: '19:22:31' },
    ],
  },
  {
    usr_ID: 'mock-008',
    usr_Name: 'Муханова Шолпан',
    usrr_ID: 'role-manager-ses',
    usrr_Name: 'СЭС менеджер',
    loc_ID: 'loc-farhi',
    loc_Name: 'Farhi',
    shifts: [
      { begin: '07:58:49', end: '11:30:05' },
      { begin: '12:15:19', end: '16:02:41' },
    ],
  },
  {
    usr_ID: 'mock-009',
    usr_Name: 'Карпыкбай Томирис',
    usrr_ID: 'role-runner',
    usrr_Name: 'Раннер',
    loc_ID: 'loc-sharzhum',
    loc_Name: 'SharZhum',
    shifts: [
      { begin: '12:18:36', end: '16:40:27' },
      { begin: '17:05:50', end: null },
    ],
  },
];

export function getMockPresence(datebegin: string): Presence[] {
  const isoDate = toIsoDate(datebegin);

  return PEOPLE.flatMap((person) =>
    person.shifts.map((shift) => ({
      usr_ID: person.usr_ID,
      usr_Name: person.usr_Name,
      usrr_ID: person.usrr_ID,
      usrr_Name: person.usrr_Name,
      loc_ID: person.loc_ID,
      loc_Name: person.loc_Name,
      uslp_DateBegin: `${isoDate}T${shift.begin}`,
      uslp_DateEnd: shift.end ? `${isoDate}T${shift.end}` : null,
    })),
  );
}

function toIsoDate(datebegin: string) {
  const [dd, mm, yyyy] = datebegin.split('.');
  if (!dd || !mm || !yyyy) return new Date().toISOString().slice(0, 10);
  return `${yyyy}-${mm}-${dd}`;
}
