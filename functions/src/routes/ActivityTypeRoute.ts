import {Router}                                 from "express";
import * as functions                           from "firebase-functions";
import {getUserid, isUseridAdmin}               from "../utils/useAuth";
import {activitytypesCol}                       from "../utils/useDb";
import {ActivityType, ActivityTypeData, EMPTY_ACTIVITYTYPE} from "../types/ActivityType";


/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const activityTypeRoute = Router();

// --------------------------------------------------------
// Helper function to get activity type for activity type id
// --------------------------------------------------------
export async function getActivityType(activitytypeid: string) {
  let activitytype: ActivityType = EMPTY_ACTIVITYTYPE;
  const activitytypeDoc = await activitytypesCol.doc(activitytypeid).get();
  if (activitytypeDoc.exists) {
    const ActivityTypeData: ActivityTypeData = activitytypeDoc.data()!;
    activitytype = { id: activitytypeid, ...ActivityTypeData };
  }
  return activitytype;
}

// ----------------
// GET ACTIVITYTYPE
// ----------------
activityTypeRoute.get("/activity/:activitytypeid", async (req, res) => {
  const docId: string = req.params.activitytypeid;
  const activitytypeDoc = await activitytypesCol.doc(docId).get();
  if (activitytypeDoc.exists) {
    const ActivityTypeData: ActivityTypeData = activitytypeDoc.data()!;
    return res.status(200).json({ id: docId, ...ActivityTypeData });
  }
  return res.status(200).json({ });
});

// ---------------------
// GET ALL ACTIVITYTYPES
// ---------------------
activityTypeRoute.get("/activitytypes", async (req, res) => {
  const resactivitytypes: Array<ActivityType>  = [];
  const activitytypeDocs = await activitytypesCol.get();
  activitytypeDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resactivitytypes.push({ id: doc.id, ...doc.data() });
  });
  return res.status(200).json(resactivitytypes);
});

// -----------------
// POST ACTIVITYTYPE
// -----------------
activityTypeRoute.post("/activitytype", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  // name:                  string,
  // description:           string, // Free text field
  // // Availability
  // availableToUsers:      boolean,       // If this should be available to users (to book themselves)
  // typelessSlots:         boolean,       // If slot is without type (i.e. single slot, not an array)

  if (!req.body.name ||
      !req.body.description)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"name\": ..., \"description\": ..., ... }");
  }

  // TODO - Unique constraint check?

  let docId = ""; // Set from res.id
  const ActivityTypeData: ActivityTypeData = {
    name:                 req.body.name,
    description:          req.body.description,
    availableToUsers:     !!req.body.availableToUsers,
    typelessSlots:        !!req.body.typelessSlots,
  };

  functions.logger.log("POST /activitytype by " + userid, ActivityTypeData);
  const docRes = await activitytypesCol.add(ActivityTypeData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...ActivityTypeData,
  });
});

// ----------------
// PUT ACTIVITYTYPE
// ----------------
activityTypeRoute.put("/activitytype/:activitytypeid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.name ||
      !req.body.description)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"name\": ..., \"description\": ..., ... }");
  }

  // TODO - Unique constraint check?

  const docId: string = req.params.activitytypeid;
  const ActivityTypeData: ActivityTypeData = {
    name:                 req.body.name,
    description:          req.body.description,
    availableToUsers:     !!req.body.availableToUsers,
    typelessSlots:        !!req.body.typelessSlots,
  };

  functions.logger.log("PUT /activitytype by " + userid, ActivityTypeData);
  // Set everything EXCEPT assistantAllocations and acceptedBookings
  await activitytypesCol.doc(docId).set({
      name:             ActivityTypeData.name,
      description:      ActivityTypeData.description,
      availableToUsers: ActivityTypeData.availableToUsers,
      typelessSlots:    ActivityTypeData.typelessSlots,  
    }, { merge: true });

  // DON'T UPDATE ACTIVITIES / BOOKINGS - TOO COMPLEX

  return res.status(200).json({
    id: docId,
    ...ActivityTypeData,
  });
});

// -------------------
// DELETE ACTIVITYTYPE
// -------------------
activityTypeRoute.delete("/activitytype/:activitytypeid", async (req, res) => {
  const activitytypeid: string = req.params.activitytypeid;

  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  functions.logger.log("DELETE /activitytype/" + activitytypeid + " by " + userid);
  await activitytypesCol.doc(activitytypeid).delete();

  return res.status(200).json({ });
});

export {activityTypeRoute};
