// Get the imports
import * as admin from "firebase-admin";
//import { initializeApp } from '@firebase/app'
import { getFirestore, CollectionReference, collection, DocumentData } from '@firebase/firestore'


// Init the firebase app
//export const firebaseApp = initializeApp()
export const firebaseApp = admin.initializeApp();

// Export firestore incase we need to access it directly
export const firestore = getFirestore()
//export const firestore = admin.firestore();

// This is just a helper to add the type to the db responses
const createCollection = <T = DocumentData>(collectionName: string) => {
  return collection(firestore, collectionName) as CollectionReference<T>
}

// Import all your model types
import { Profile } from '../types/Profile'
import { Role } from '../types/Role'
import { Assistant } from '../types/Assistant'

// export all your collections
export const profilesCol = createCollection<Profile>('profiles')
export const rolesCol = createCollection<Role>('roles')
export const assistantsCol = createCollection<Assistant>('asistants')