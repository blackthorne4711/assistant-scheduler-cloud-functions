export interface PeriodData {
  name: string,
  from: number,
  to: number,
  status: string, // I.e. only allow bookings on timeslot in active period
  description?: string, // Free text field
}

export interface Period extends PeriodData {
  id: string
}

export enum PeriodStatus {
  PREPARE = 'PREPARE',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIED',
  UNDEFINED = '',
}
