import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import {rolesCol, assistantsCol} from "../utils/useDb";
import {AuthUser} from "../types/AuthUser";

// Extending Express Request
export interface RequestCustom extends express.Request
{
    decodedIdToken: admin.auth.DecodedIdToken ;
}

// Helper function to get Userid from HTTP request
export function getUserid(req: express.Request) {
  const reqCust = req as RequestCustom;
  return reqCust.decodedIdToken.email as string;
}

// Helper function to check if user is Admin
export async function isUseridAdmin(userid: string) {
  let isAdmin = false;

  const singleRoleDocRef = rolesCol.doc(userid);
  const singleRoleDoc = await singleRoleDocRef.get();
  const singleRole = singleRoleDoc.data();

  if (singleRole) {
    isAdmin = singleRole.admin;
  }

  return isAdmin;
}

// Helper function to check if user has authz for assistant
export async function isUserForAssistant(userid: string, assistant: string) {
  let isUserForAssistant = false;
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

// Helper function to get Assistant type for an assistand id
export async function getAssistantType(assistantid:string) {
  let assistantType = "";
  const assistantDoc = await assistantsCol.doc(assistantid).get();
  const assistant = assistantDoc.data();

  if (assistant) {
    assistantType = assistant.type;
  }

  return assistantType;
}

// Helper function to list Auth users (user from Firebase Auth)
export async function listAuthUsers(): Promise<AuthUser[]> {
  return new Promise<AuthUser[]>((resolve, reject) => {
    const authUserList: AuthUser[] = [];

    admin.auth().listUsers(1000) // lists up to 1000 users
      .then((listUsersResult) => {
        for (let i = 0; i < listUsersResult.users.length; i++) {
          const {uid, email, emailVerified, disabled} = listUsersResult.users[i];
          authUserList.push({"uid": uid, "id": email!, "email": email!, "emailVerified": emailVerified!, "disabled": disabled!});
        }

        if (listUsersResult.pageToken) {
          functions.logger.error("listAuthUsers() - OVER 1000 - " + listUsersResult.pageToken);
        }
        resolve(authUserList);
      })
      .catch(function(error) {
        functions.logger.error("listAuthUsers() - " + error.message);
        reject(error);
      });
  });
}

// Helper function to get an Auth user from uid (user from Firebase Auth)
export async function getAuthUser(uid: string): Promise<AuthUser> {
  return new Promise<AuthUser>((resolve, reject) => {
    admin.auth().getUser(uid)
      .then((userResult) => {
        const {uid, email, emailVerified, disabled} = userResult;
        resolve({"uid": uid, "id": email!, "email": email!, "emailVerified": emailVerified!, "disabled": disabled!});
      })
      .catch(function(error) {
        functions.logger.error("getAuthUser() - " + error.message);
        reject(error);
      });
  });
}

export async function createAuthUser(email: string, password: string, fullname: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    admin.auth().createUser({
        email:         email,
        emailVerified: false,
        password:      password,
        displayName:   fullname,
        disabled:      false,
      })
      .then((userResult) => {
        const uid = userResult.uid;
        resolve(uid);
      })
      .catch(function(error) {
        reject(error);
      });
  });
}

export async function setAuthUserDisabled(uid: string, disabled: boolean): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    admin.auth().updateUser(uid, {
      disabled: disabled,
    }).then(() => {
      resolve(uid);
    }).catch((error) => {
      reject(error);
    });
  });
}

export async function deleteAuthUser(uid: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    admin.auth().deleteUser(uid).then(() => {
      resolve(uid);
    }).catch((error) => {
      reject(error);
    });
  });
}

export async function setAuthUserPassword(uid: string, password: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    admin.auth().updateUser(uid, {
        password:      password,
      })
      .then((userResult) => {
        const uid = userResult.uid;
        resolve(uid);
      })
      .catch(function(error) {
        reject(error);
      });
  });
}

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
