export interface TimeslotData {
  date:              string, // YYYY-MM-DD
  color?:            string, // For visualization in frontend
  startTime:         string, // HH24:MM
  endTime:           string, // HH24:MM
  period:            string,
  type?:             string, // For filtering in frontend
  fromSchedule?:     string, // If generated by a schedule
  fromScheduleName?: string, // If generated by a schedule
  description?:      string, // Free text field for individual timeslot
  contact?:          string, // For info
  assistantSlots:    Array<string>, // Array of slots (number) in increasing assistant level
}

export interface Timeslot extends TimeslotData {
  id: string
}