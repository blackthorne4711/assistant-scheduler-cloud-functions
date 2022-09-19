export interface PeriodData {
  name: string,
  from: string, // YYYY-MM-DD
  to: string,   // YYYY-MM-DD
  status: string, // I.e. only allow bookings on timeslot in active period
  description?: string, // Free text field
}

export interface Period extends PeriodData {
  id: string
}

export enum PeriodStatus {
  PREPARE = "PREPARE",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  ARCHIVED = "ARCHIVED",
  UNDEFINED = "",
}
