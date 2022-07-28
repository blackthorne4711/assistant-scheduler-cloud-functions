// Get the imports
import * as admin from "firebase-admin";
//import * as app from "@firebase/app"
//import { getFirestore, CollectionReference, collection, DocumentData } from '@firebase/firestore'
//import { CollectionReference, DocumentData } from '@firebase/firestore'


// Init the firebase app
//export const firebaseApp = app.initializeApp()
export const app = admin.initializeApp();

// Export firestore incase we need to access it directly
//export const firestore = getFirestore(firebaseApp)
export const db = admin.firestore();

// This is just a helper to add the type to the db responses
const createCollection =
  <T = FirebaseFirestore.DocumentData>(collectionName: string) => {
  return db.collection(collectionName) as FirebaseFirestore.CollectionReference<T>;
}

// Import all your model types
import { Profile } from '../types/Profile'
import { Role } from '../types/Role'
import { Assistant } from '../types/Assistant'

// export all your collections
export const profilesCol = createCollection<Profile>('profiles')
export const rolesCol = createCollection<Role>('roles')
export const assistantsCol = createCollection<Assistant>('asistants')