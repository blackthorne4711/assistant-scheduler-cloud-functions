import * as functions             from "firebase-functions";
import {Router}                   from "express";
import {getUserid, isUseridAdmin} from "../utils/useAuth";
import {profilesCol}              from "../utils/useDb";
import {Profile, ProfileData, EMPTY_PROFILE} from "../types/Profile";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const profileRoute = Router();

// -------------------------------------------------------------
// GET (current) PROFILE - get profile and role for current user
// -------------------------------------------------------------
profileRoute.get("/profile", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  let profile: Profile = EMPTY_PROFILE;
  const profileDoc = await profilesCol.doc(userid).get();
  if (profileDoc.exists) {
    const profileData: ProfileData = profileDoc.data()!;
    profile = { id: userid, ...profileData };
  }
  // TODO - Maybe add handling if no doc found?
  // res.header("Access-Control-Allow-Origin", "*");

  return res.status(200).json(profile);
});

// ---------------------------------------------
// GET PROFILE - get profile and role for userid
// ---------------------------------------------
profileRoute.get("/profile/:userid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = req.params.userid;

  let profile: Profile = EMPTY_PROFILE;
  const profileDoc = await profilesCol.doc(userid).get();
  if (profileDoc.exists) {
    const profileData: ProfileData = profileDoc.data()!;
    profile = { id: userid, ...profileData };
  }

  return res.status(200).json(profile);
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
    phone:     req.body.phone ? req.body.phone : "",
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
