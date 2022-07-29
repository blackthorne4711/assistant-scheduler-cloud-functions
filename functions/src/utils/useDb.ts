import * as admin from "firebase-admin";

// Init the firebase app
export const app = admin.initializeApp();

// Export firestore incase we need to access it directly
export const db = admin.firestore();

// ToDO - Should this be used or not?
db.settings({ ignoreUndefinedProperties: true })

// This is just a helper to add the type to the db responses
const createCollection =
  <T = FirebaseFirestore.DocumentData>(collectionName: string) => {
  return db.collection(collectionName) as FirebaseFirestore.CollectionReference<T>;
}

// Import all your model types
import { AssistantData } from '../types/Assistant'
import { BookingData } from '../types/Booking'
import { PeriodData } from '../types/Period'
import { ProfileData } from '../types/Profile'
import { RoleData } from '../types/Role'
import { TimeslotData } from '../types/Timeslot'

// export all your collections
export const assistantsCol = createCollection<AssistantData>('assistants')
export const bookingsCol = createCollection<BookingData>('bookings')
export const periodsCol = createCollection<PeriodData>('periods')
export const profilesCol = createCollection<ProfileData>('profiles')
export const rolesCol = createCollection<RoleData>('roles')
export const timeslotsCol = createCollection<TimeslotData>('timeslots')
