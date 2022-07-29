import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import {rolesCol} from '../utils/useDb'

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
    console.log(singleRole.admin)
    isAdmin = singleRole.admin;
  }

  return isAdmin;
}

export async function isUserForAssistant(userid: string, assistant: string) {
  let isUserForAssistant: boolean = false;

  const singleRoleDoc = await rolesCol.doc(userid).get();
  const singleRole = singleRoleDoc.data();

  if (singleRole) {
    const userForAssistants = singleRole.userForAssistants;

    userForAssistants.forEach((userForAssistant: string) => {
      if (assistant == userForAssistant) {
        isUserForAssistant = true;
      }
    });
  }

  return isUserForAssistant;
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