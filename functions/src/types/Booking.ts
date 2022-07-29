export interface BookingData {
  timeslot: string,
  assistant: string,
  bookedBy: string,
  bookedDatetime: number,
  comment?: string, // I.e. for comment to Contact person
  status: string, // To handle double booking scenario and booking rules
  statusMessage?: string, // To be used with REJECTED or REMOVED status
}

export interface Booking extends BookingData {
  id: string
}

export enum BookingStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED', // Automatic reject - by booking rules
  REMOVED = 'REMOVED', // Manual removal - either by user or admin
}
