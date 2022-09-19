import * as functions             from "firebase-functions";
import {Router}                   from "express";
import {getUserid, isUseridAdmin} from "../utils/useAuth";
import {profilesCol}              from "../utils/useDb";
import {Profile, ProfileData}     from "../types/Profile";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const profileRoute = Router();

// -------------------------------------------------------------
// GET (current) PROFILE - get profile and role for current user
// -------------------------------------------------------------
profileRoute.get("/profile", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const docId:      string = userid;
  let docEmail:     string = "";
  let docFirstName: string = "";
  let docLastName:  string = "";
  let docRole:      string = "";

  const docRes: FirebaseFirestore.DocumentData =
    await profilesCol.doc(userid).get();
  if (docRes.exists) {
    docEmail = docRes.data().email;
    docFirstName = docRes.data().firstName;
    docLastName = docRes.data().lastName;
    docRole = "USER";

    if (await isUseridAdmin(userid)) {
      docRole = "ADMIN";
    }
  }

  // TODO - Maybe add handling if no doc found?

  res.header("Access-Control-Allow-Origin", "*");

  return res.status(200).json({
    id: docId,
    email: docEmail,
    firstname: docFirstName,
    lastname: docLastName,
    role: docRole,
  });
});

// ---------------------------------------------
// GET PROFILE - get profile and role for userid
// ---------------------------------------------
profileRoute.get("/profile/:userid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = req.params.userid;
  const docId:      string = userid;
  let docEmail:     string = "";
  let docFirstName: string = "";
  let docLastName:  string = "";

  const docRes: FirebaseFirestore.DocumentData =
    await profilesCol.doc(userid).get();
  if (docRes.exists) {
    docEmail = docRes.data().email;
    docFirstName = docRes.data().firstName;
    docLastName = docRes.data().lastName;
  }

  // TODO - Maybe add handling if no doc found?

  return res.status(200).json({
    id: docId,
    email: docEmail,
    firstname: docFirstName,
    lastname: docLastName,
  });
});

// -------------------------------
// GET PROFILES - get all profiles
// -------------------------------
profileRoute.get("/profiles", async (req, res) => {
  const resProfiles: Array<Profile>  = [];
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  const docRes = await profilesCol.orderBy("email").get();
  docRes.forEach((doc: FirebaseFirestore.DocumentData) => {
    resProfiles.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resProfiles);
});

// ---------------------------------------------------------
// POST PROFILE - create profile (USER: current, ADMIN: any)
// ---------------------------------------------------------
profileRoute.post("/profile", async (req, res) => {
  const userid = getUserid(req);

  if (!req.body.email     ||
      !req.body.firstname ||
      !req.body.lastname)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { email: ..., firstname: ..., lastname: ... }");
  }

  const docId: string = req.body.email; // Set email as id
  const profileData: ProfileData = {
    email:     req.body.email,
    firstname: req.body.firstname,
    lastname:  req.body.lastname,
  };

  // TODO - Checks on strings?

  if (userid == docId) {
    // Allowed for all authenticated users
    functions.logger.log("POST /profile for current user - " + userid);
  } else {
    const isAdmin: boolean = await isUseridAdmin(userid);
    if (isAdmin) {
      // Allowed for Admin
      functions.logger.log("POST /profile for other user - " + userid + " by " + docId);
    } else {
      return res.status(403).json("Not allowed for non-admin, if not current user");
    }
  }

  // Set Profile (overwrite if exists)
  await profilesCol.doc(docId).set(profileData);

    return res.status(200).json({
    id: docId,
    ...profileData,
  });
});

export {profileRoute};
