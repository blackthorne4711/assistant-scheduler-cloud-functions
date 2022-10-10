import {Router} from "express";
import * as functions from "firebase-functions";
// Auth
import {getUserid,
        isUseridAdmin,
        listAuthUsers,
        getAuthUser,
        createAuthUser,
        deleteAuthUser,
        setAuthUserDisabled,
        setAuthUserPassword} from "../utils/useAuth";
import {AuthUser}            from "../types/AuthUser";
import {AuthUserRoleProfile} from "../types/AuthUserRoleProfile";
// DB
import {rolesCol, profilesCol, assistantsCol} from "../utils/useDb";
import {Role, RoleData}           from "../types/Role";
import {Profile, ProfileData}     from "../types/Profile";
import {Assistant}                from "../types/Assistant";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const userRoute = Router();

// ----------------------------------------------
// Helper function to get assistants for user id
// ----------------------------------------------
export async function getAssistantsForUser(userid: string) {
  let userForAssistants: Array<string> = [];

  const roleDoc = await rolesCol.doc(userid).get();
  if (roleDoc.exists) {
      const roleData: RoleData = roleDoc.data()!;
      userForAssistants = roleData.userForAssistants;
  }

  return userForAssistants;
}

// ------------------
// GET (current) USER
// ------------------
userRoute.get("/user", async (req, res) => {
  const userid = getUserid(req);

  const roleDoc = await rolesCol.doc(userid).get();
  if (roleDoc.exists) {
      const roleData: RoleData = roleDoc.data()!;
      return res.status(200).json({ id: userid, ...roleData });
  }
  return res.status(200).json({ });
});

// ----------
// GET USERS
// ----------
userRoute.get("/users", async (req, res) => {
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    functions.logger.error("GET /users - not allowed - " + userid);
      return res.status(403).json("Not allowed for non-admin");
  }
  let   resAuthUsers:            Array<AuthUser>            = [];
  const resRoles:                Array<Role>                = [];
  const resProfiles:             Array<Profile>             = [];
  const resAuthUserRoleProfiles: Array<AuthUserRoleProfile> = [];
  // For Assistant fullname (for search)
  const resAssistants:           Array<Assistant>           = [];

  resAuthUsers = await listAuthUsers();

  const roleDocs = await rolesCol.get();
  roleDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
      resRoles.push({ id: doc.id, ...doc.data() });
  });

  const profileDocs = await profilesCol.get();
  profileDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
      resProfiles.push({ id: doc.id, ...doc.data() });
  });

  const assistantDocs = await assistantsCol.get();
  assistantDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
      resAssistants.push({ id: doc.id, ...doc.data() });
  });

  for (let i=0; i < resAuthUsers.length; i++) {
    const userForAssistantsFullname = [] as Array<string>;
    const matchingRole = resRoles.find((x) => x.id === resAuthUsers[i].id);
    const matchingProfile = resProfiles.find((x) => x.id === resAuthUsers[i].id);

    if (matchingRole) {
      for (let j=0; j < matchingRole.userForAssistants.length; j++) {
        const matchingAssistant = resAssistants.find((x) => x.id === matchingRole.userForAssistants[j]);
        userForAssistantsFullname[j] = matchingAssistant ? matchingAssistant.fullname : "";
      }
    }
    
    if (matchingRole && matchingProfile) {
      resAuthUserRoleProfiles.push({
          ...resAuthUsers[i],
          "admin":             matchingRole.admin,
          "userForAssistants": matchingRole.userForAssistants,
          "userForAssistantsFullname": userForAssistantsFullname,
          "firstname":         matchingProfile.firstname,
          "lastname":          matchingProfile.lastname,
          "phone":             matchingProfile.phone,
        });
    } else if (matchingRole) {
      resAuthUserRoleProfiles.push({
          ...resAuthUsers[i],
          "admin":             matchingRole.admin,
          "userForAssistants": matchingRole.userForAssistants,
          "userForAssistantsFullname": userForAssistantsFullname,
          "firstname":         "",
          "lastname":          "",
          "phone":             "",
        });
    }
  }
  return res.status(200).json(resAuthUserRoleProfiles);
});

// --------
// PUT USER
// --------
userRoute.put("/user/:uid", async (req, res) => {
  const currentuserid = getUserid(req);
  const uid = req.params.uid;

  // CHECK IF ADMIN
  const isAdmin: boolean = await isUseridAdmin(currentuserid);
  if (!isAdmin) {
    functions.logger.error("PUT /user - not allowed - " + currentuserid + " " + uid);
    return res.status(403).json("Not allowed for non-admin");
  }

  // CHECK INPUT
  if (!req.body.firstname ||
      !req.body.lastname  ||
      !req.body.userForAssistants) {
      return res.status(400).send("Incorrect body.\n Correct syntax is: { firstname: ..., lastname: ..., userForAssistants [ ... ] }");
  }

  // GET AUTH USER (NO UPDATE)
  const authUser: AuthUser = await getAuthUser(uid);
  const email = authUser.email;

  // UPDATE PROFILE
  const profileData: ProfileData = {
    email:     email,
    firstname: req.body.firstname,
    lastname:  req.body.lastname,
    phone:     req.body.phone ? req.body.phone : "",
  };
  functions.logger.log("PUT /user by " + email, profileData);
  await profilesCol.doc(email).set(profileData);

  // UPDATE ROLE
  const roleData: RoleData = {
      admin:             !!req.body.admin,
      userForAssistants: req.body.userForAssistants,
  };
  functions.logger.log("PUT /user by " + email, roleData);
  await rolesCol.doc(email).set(roleData);

  return res.status(200).json({
    id: uid,
    ...profileData,
    ...roleData,
  });
});

// ---------
// POST USER
// ---------
userRoute.post("/user", async (req, res) => {
  const currentuserid = getUserid(req);
  let   uid = "";

  // CHECK IF ADMIN
  const isAdmin: boolean = await isUseridAdmin(currentuserid);
  if (!isAdmin) {
    functions.logger.error("PUT /user - not allowed - " + currentuserid);
    return res.status(403).json("Not allowed for non-admin");
  }

  // CHECK INPUT
  if (!req.body.email     ||
      !req.body.password  ||
      !req.body.firstname ||
      !req.body.lastname  ||
      !req.body.userForAssistants) {
      return res.status(400).send("Incorrect body.\n Correct syntax is: { email: ..., password: ..., firstname: ..., lastname: ..., userForAssistants [ ... ] }");
  }

  // CREATE AUTH USER
  const email    = req.body.email;
  const password = req.body.password;
  const fullname = req.body.firstname + " " + req.body.lastname;
  await createAuthUser(email, password, fullname)
    .then((_uid) => {
      uid = _uid;
      functions.logger.info("Successfully created new user", uid);
    })
    .catch((error) => {
      functions.logger.error("Error creating new user", error);
      return res.status(500).json({ status: "error", msg: "Error creating new user - " + currentuserid, data: error });
    });

  // SET PROFILE
  const profileData: ProfileData = {
    email:     email,
    firstname: req.body.firstname,
    lastname:  req.body.lastname,
    phone:     req.body.phone ? req.body.phone : "",
  };
  functions.logger.info("POST /user by " + currentuserid, profileData);
  await profilesCol.doc(email).set(profileData);

  // SET ROLE
  const roleData: RoleData = {
      admin:             !!req.body.admin,
      userForAssistants: req.body.userForAssistants,
  };
  functions.logger.info("POST /user by " + currentuserid, roleData);
  await rolesCol.doc(email).set(roleData);

  return res.status(200).json({
    id: uid,
    ...profileData,
    ...roleData,
  });  
});

// --------
// POST SET PASSWORD
// --------
userRoute.put("/user/:uid/password", async (req, res) => {
  const currentuserid = getUserid(req);
  const uid = req.params.uid;
  // CHECK IF ADMIN
  const isAdmin: boolean = await isUseridAdmin(currentuserid);
  if (!isAdmin) {
    functions.logger.error("POST /user/:uid/password - not allowed - " + currentuserid);
    return res.status(403).json("Not allowed for non-admin");
  }
  // CHECK INPUT
  if (!req.body.password) {
      return res.status(400).send("Incorrect body.\n Correct syntax is: { password: ... }");
  }
  // SET AUTH USER PASSWORD
  const password = req.body.password;
  await setAuthUserPassword(uid, password)
    .then((_uid) => {
      functions.logger.info("Successfully set new password", _uid);
    })
    .catch((error) => {
      functions.logger.error("Error setting password", error);
      return res.status(500).json({ status: "error", msg: "Error setting password - " + uid, data: error });
    });
  return res.status(200).json({
    id: uid,
  });  
});

// --------
// PUT SET DISABLED
// --------
userRoute.put("/user/:uid/disabled", async (req, res) => {
  const currentuserid = getUserid(req);
  const uid = req.params.uid;
  // CHECK IF ADMIN
  const isAdmin: boolean = await isUseridAdmin(currentuserid);
  if (!isAdmin) {
    functions.logger.error("POST /user/:uid/disabled - not allowed - " + currentuserid);
    return res.status(403).json("Not allowed for non-admin");
  }
  // SET AUTH USER DISABLED
  const disabled = !!req.body.disabled;
  await setAuthUserDisabled(uid, disabled)
    .then((_uid) => {
      functions.logger.info("Successfully set disabled (" + disabled + ")", _uid);
    })
    .catch((error) => {
      functions.logger.error("Error setting disabled", error);
      return res.status(500).json({ status: "error", msg: "Error setting disabled - " + uid, data: error });
    });
  return res.status(200).json({
    id: uid,
  });  
});

// -----------------------------
// DELETE USER (+Role & Profile)
// -----------------------------
userRoute.delete("/user/:uid", async (req, res) => {
  const currentuserid = getUserid(req);
  const uid = req.params.uid;
  // CHECK IF ADMIN
  const isAdmin: boolean = await isUseridAdmin(currentuserid);
  if (!isAdmin) {
    functions.logger.error("DELETE /user/:uid - not allowed - " + currentuserid);
    return res.status(403).json("Not allowed for non-admin");
  }
  // GET AUTH USER EMAIL
  const authUser: AuthUser = await getAuthUser(uid);
  const email = authUser.email;
  // DELETE AUTH USER
  await deleteAuthUser(uid)
    .then((_uid) => {
      functions.logger.info("Successfully deleted user (" + email + ")", _uid);
      // DELETE PROFILE
      profilesCol.doc(email).delete();
      // DELETE ROLE
      rolesCol.doc(email).delete();
    })
    .catch((error) => {
      functions.logger.error("Error setting disabled", error);
      return res.status(500).json({ status: "error", msg: "Error setting disabled - " + uid, data: error });
    });
  return res.status(200).json();  
});

export {userRoute};
