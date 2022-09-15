export interface ScheduleData {
  name:              string,

  scheduleStartDate: string, // YYYY-MM-DD
  scheduleEndDate:   string, // YYYY-MM-DD
  recurrenceDays:    string, // Number of days between each timeslot, e.g. 7 for weekly
  initStartDatetime: string, // YYYY-MM-DD HH24:MM:SS
  initEndDatetime:   string, // YYYY-MM-DD HH24:MM:SS

  period:            string, // For period status handling, e.g. only generate timeslots for OPEN period

  description?:      string, // Free text field for individual timeslot
  color?:            string, // For visualization in frontend
  type?:             string, // For filtering in frontend
  contact?:          string, // For info
  assistantSlots:    Array<number>, // Array of slots (number) in increasing assistant level
}

export interface Schedule extends ScheduleData {
  id: string
}