import * as functions from "firebase-functions";
//import {DecodedIdToken} from "firebase-admin/auth";
import * as admin from "firebase-admin";
import * as express from "express";

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