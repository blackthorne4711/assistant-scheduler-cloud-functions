export interface ActivityBookingData {
  activity:           string,
  activityDate:       string, // Denormalized to handle sorting and fetching current
  activityWeekday:    string, // Denormalized to handle sorting
  activityTime:       string, // Denormalized to handle sorting
  activityColor:      string, // Denormalized
  activityPeriod:     string, // Denormalized to handle lookup from period id
  assistant:          string,
  assistantType:      string, // Denormalized to handle assistants changing type (activitybooking will remain)
  assistantFullname?: string, // Added on read (to frontend)
  bookedBy:           string,
  bookedDatetime:     string, // YYYY-MM-DD HH24:MM:SS
  updatedBy?:         string,
  updatedDatetime?:   string, // YYYY-MM-DD HH24:MM:SS
  comment?:           string, // I.e. for comment to Contact person
  status:             string, // To handle double activitybooking scenario and activitybooking rules
  statusMessage?:     string, // To be used with REJECTED or REMOVED status
}

export interface ActivityBooking extends ActivityBookingData {
  id: string
}

export enum ActivityBookingStatus {
  REQUESTED = "REQUESTED",
  ACCEPTED  = "ACCEPTED" ,
  REJECTED  = "REJECTED" , // Automatic reject - by activitybooking rules
  REMOVED   = "REMOVED"  , // Manual removal - either by user or admin
}
