export interface BookingData {
  timeslot:        string,
  timeslotDate:    string, // Denormalized to handle sorting and fetching current
  timeslotWeekday: string, // Denormalized to handle sorting
  timeslotTime:    string, // Denormalized to handle sorting
  timeslotPeriod:  string, // Denormalized to handle lookup from period id
  assistant:       string,
  assistantType:   string, // Denormalized to handle assistants changing type (booking will remain)
  assistantName?:  string, // Added on read (to frontend)
  bookedBy:        string,
  bookedDatetime:  string, // YYYY-MM-DD HH24:MM:SS
  comment?:        string, // I.e. for comment to Contact person
  status:          string, // To handle double booking scenario and booking rules
  statusMessage?:  string, // To be used with REJECTED or REMOVED status
}

export interface Booking extends BookingData {
  id: string
}

export enum BookingStatus {
  REQUESTED = "REQUESTED",
  ACCEPTED  = "ACCEPTED" ,
  REJECTED  = "REJECTED" , // Automatic reject - by booking rules
  REMOVED   = "REMOVED"  , // Manual removal - either by user or admin
}
