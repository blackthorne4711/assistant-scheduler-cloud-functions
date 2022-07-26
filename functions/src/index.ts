import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {DecodedIdToken} from "firebase-admin/auth";
import * as express from "express";

admin.initializeApp();

const db = admin.firestore();

// This is just a helper to add the type to the db responses
// const createCollection = <T = DocumentData>(collectionName: string) => {
//   return collection(firestore, collectionName) as CollectionReference<T>
// }

const app = express();

// Extending Express Request
export interface RequestCustom extends express.Request
{
    decodedIdToken: DecodedIdToken ;
}

// Express authentication middleware
const authenticate = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction) => {
// functions.logger.log("GET authenticate init");

  if (!req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer ")) {
    functions.logger.warn("authenticate - req.headers.authorization");
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
    functions.logger.warn("authenticate - verifyIdToken");
    functions.logger.warn((error as Error).message);
    res.status(403).send("Unauthorized");
    return;
  }
};
app.use(authenticate);

// GET /api/profile
// Get profile for current user
app.get("/profile/", async (req, res) => {
  let userid: string;

  try {
    const reqCust = req as RequestCustom;
    userid = reqCust.decodedIdToken.email as string;
    functions.logger.log("GET /profile for current user" + userid);
  } catch (error) {
    functions.logger.error(
        "ERROR - GET /profile",
        (error as Error).message
    );
    return res.sendStatus(500);
  }

  try {
    const resProfiles: Array<{
      id: string,
      email: string,
      firstname: string,
      lastname: string
    }>= [];
    const doc: FirebaseFirestore.DocumentData =
      await db.collection("profiles").doc(userid).get();

    if (doc.exists) {
      // console.log(doc.data());
      const resId: string = doc.id;
      const resEmail: string = doc.data().email;
      const resFirstName: string = doc.data().firstName;
      const resLastName: string = doc.data().lastName;

      resProfiles.push({
        "id": resId,
        "email": resEmail,
        "firstname": resFirstName,
        "lastname": resLastName,
      });

      return res.status(200).json(resProfiles);
    } else {
      console.log("Profile not found - " + userid);
      return res.status(200).json("{}");
    }
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }
});

// GET /profiles
// Get all profiles
app.get("/profiles", async (req, res) => {
  try {
    const resProfiles: Array<{
      id: string,
      email: string,
      firstname: string,
      lastname: string
    }>= [];
    const profilesSnap = await db.collection("profiles").orderBy("email").get();

    profilesSnap.forEach((doc: FirebaseFirestore.DocumentData) => {
      const resId: string = doc.id;
      const resEmail: string = doc.data().email;
      const resFirstName: string = doc.data().firstName;
      const resLastName: string = doc.data().lastName;

      resProfiles.push({
        "id": resId,
        "email": resEmail,
        "firstname": resFirstName,
        "lastname": resLastName,
      });
      // resProfiles.push(doc.data())
    });

    // console.log("resProfiles - " + JSON.stringify(resProfiles));

    return res.status(200).json(resProfiles);
    // return res.status(200).send(JSON.stringify(resProfiles));
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }
});

// Expose API as a function
exports.api = functions.https.onRequest(app);
