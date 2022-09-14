import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import {rolesCol} from '../utils/useDb'
import {assistantsCol} from '../utils/useDb'
import {AuthUser} from "../types/AuthUser"

// Extending Express Request
export interface RequestCustom extends express.Request
{
    decodedIdToken: admin.auth.DecodedIdToken ;
}

// Helper function
export function getUserid(req: express.Request) {
  const reqCust = req as RequestCustom;
  return reqCust.decodedIdToken.email as string;
};

export async function isUseridAdmin(userid: string) {
  let isAdmin: boolean = false;

  const singleRoleDocRef = rolesCol.doc(userid);
  const singleRoleDoc = await singleRoleDocRef.get();
  const singleRole = singleRoleDoc.data();

  if (singleRole) {
    isAdmin = singleRole.admin;
  }

  return isAdmin;
}

export async function isUserForAssistant(userid: string, assistant: string) {
  let isUserForAssistant: boolean = false;
  const roleDoc = await rolesCol.doc(userid).get();
  const role = roleDoc.data();

  if (role) {
    const userForAssistants = role.userForAssistants;

    userForAssistants.forEach((userForAssistant: string) => {
      if (assistant == userForAssistant) {
        isUserForAssistant = true;
      }
    });
  }

  return isUserForAssistant;
}

export async function getAssistantType(assistantid:string) {
  let assistantType: number = -1;
  const assistantDoc = await assistantsCol.doc(assistantid).get();
  const assistant = assistantDoc.data();

  if (assistant) {
    assistantType = assistant.type;
  }

  return assistantType;
}

// UserRecord {'
// id: 'IQVP024QoEh4Y9imPKJ2bbeNId53',
// email: 'erik@stallhjalpen.se',
// emailVerified: false,
// displayName: undefined,
// photoURL: undefined,
// phoneNumber: undefined,
// disabled: false,
// metadata: UserMetadata {
//   creationTime: 'Sat, 10 Sep 2022 11:47:08 GMT',
//   lastSignInTime: null,
//   lastRefreshTime: null
// },
// providerData: [
//   UserInfo {
//     uid: 'erik@stallhjalpen.se',
//     displayName: undefined,
//     email: 'erik@stallhjalpen.se',
//     photoURL: undefined,
//     providerId: 'password',
//     phoneNumber: undefined
//   }
// ],
// passwordHash: 'RqQdBGRI6biBVebQ6u9nIEzEVfrCSRJinrZV5uZaWlx5YhQjoRBp88jEgy1n61wHYgrmQPasCdkl6qpxch5H-A==',
// passwordSalt: 'Nxk1L8AujKUe7Q==',
// tokensValidAfterTime: 'Sat, 10 Sep 2022 11:47:08 GMT',
// tenantId: undefined

export async function listAuthUsers(): Promise<AuthUser[]> {
  return new Promise<AuthUser[]>((resolve, reject) => {
    let authUserList: AuthUser[] = [];

    admin.auth().listUsers(1000) // lists up to 1000 users
    .then((listUsersResult) => {
      for (let i = 0; i < listUsersResult.users.length; i++) {
        const {uid, email, emailVerified, disabled } = listUsersResult.users[i];
        authUserList.push({"uid": uid, "id": email!, "email": email!, "emailVerified": emailVerified!, "disabled": disabled! });
      }

      if (listUsersResult.pageToken) {
        functions.logger.error("listAuthUsers() - OVER 1000 - " + listUsersResult.pageToken);
      }

      //console.log(authUserList);
      resolve(authUserList);
    })
    .catch(function (error) {
      functions.logger.error("listAuthUsers() - " + error.message);
      reject(error);
    });
  });
}

// TODO - create user
// getAuth()
//   .createUser({
//     uid: 'some-uid',
//     email: 'user@example.com',
//     phoneNumber: '+11234567890',
//   })
//   .then((userRecord) => {
//     // See the UserRecord reference doc for the contents of userRecord.
//     console.log('Successfully created new user:', userRecord.uid);
//   })
//   .catch((error) => {
//     console.log('Error creating new user:', error);
//   });

// TODO - update user
// getAuth()
//   .updateUser(uid, {
//     email: 'modifiedUser@example.com',
//     phoneNumber: '+11234567890',
//     emailVerified: true,
//     password: 'newPassword',
//     displayName: 'Jane Doe',
//     photoURL: 'http://www.example.com/12345678/photo.png',
//     disabled: true,
//   })
//   .then((userRecord) => {
//     // See the UserRecord reference doc for the contents of userRecord.
//     console.log('Successfully updated user', userRecord.toJSON());
//   })
//   .catch((error) => {
//     console.log('Error updating user:', error);
//   });

// Express authentication middleware
export const authenticate = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction) => {
  if (!req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer ")) {
    functions.logger.warn("Unauthorized - authenticate - req.headers.authorization");
    res.status(403).send("Unauthorized");
    return;
  }
  const idToken = req.headers.authorization.split("Bearer ")[1];
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    const reqCust = req as RequestCustom;
    reqCust.decodedIdToken = decodedIdToken;
    next();
    return;
  } catch (error) {
    functions.logger.warn("Unauthorized - authenticate - verifyIdToken");
    functions.logger.warn((error as Error).message);
    res.status(403).send("Unauthorized \n\n" + (error as Error).message);
    return;
  }
};