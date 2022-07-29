export interface TimeslotData {
  name: string, // 
  startDatetime: number,
  endDatetime: number,
  durationInHours: number, // I.e. 4,5
  timeDesc: string, // I.e. 08:00-12:30
  weekday: string,
  period: string,
  fromSchedule: string,
  description?: string, // Free text field for individual timeslot
  color: string, // For visualization in frontend
  type: string, // For filtering in frontend
  contact?: string, // For info
}

export interface Timeslot extends TimeslotData {
  id: string
}