import {Router}                                 from "express";
import * as functions                           from "firebase-functions";
import {getUserid, isUseridAdmin}               from "../utils/useAuth";
import {activitiesCol, periodsCol, activitybookingsCol} from "../utils/useDb";
import {Activity, ActivityData, EMPTY_ACTIVITY} from "../types/Activity";

// Import helper functions
import { getWeekday } from "../utils/helperfunctions";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const activityRoute = Router();

// -----------------------------------------------
// Helper function to get activity for activity id
// -----------------------------------------------
export async function getActivity(activityid: string) {
  let activity: Activity = EMPTY_ACTIVITY;

  const activityDoc = await activitiesCol.doc(activityid).get();
  if (activityDoc.exists) {
    const activityData: ActivityData = activityDoc.data()!;
    activity = { id: activityid, ...activityData };
  }

  return activity;
}

// -------------
// GET ACTIVITY
// -------------
activityRoute.get("/activity/:activityid", async (req, res) => {
  const docId: string = req.params.activityid;
  const activityDoc = await activitiesCol.doc(docId).get();
  if (activityDoc.exists) {
    const activityData: ActivityData = activityDoc.data()!;
    return res.status(200).json({ id: docId, ...activityData });
  }
  return res.status(200).json({ });
});

// ------------------
// GET ALL ACTIVITIES
// ------------------
activityRoute.get("/activities", async (req, res) => {
  const resActivities: Array<Activity>  = [];
  const activityDocs = await activitiesCol.get();

  activityDocs.forEach((doc: FirebaseFirestore.DocumentData) => { resActivities.push({ id: doc.id, ...doc.data() }); });

  return res.status(200).json(resActivities);
});

// -----------------------------
// GET ALL ACTIVITIES FOR PERIOD
// -----------------------------
activityRoute.get("/activities/period/:periodid", async (req, res) => {
  const periodId:     string           = req.params.periodid;
  const resActivities: Array<Activity>  = [];
  const activityDocs = await activitiesCol.where("period", "==", periodId).get();

  activityDocs.forEach((doc: FirebaseFirestore.DocumentData) => { resActivities.push({ id: doc.id, ...doc.data() }); });

  return res.status(200).json(resActivities);
});

// -------------------------------------
// GET ALL OPEN (AND CURRENT) ACTIVITIES 
// -------------------------------------
activityRoute.get("/activities/open", async (req, res) => {
  const periodDocs = await periodsCol.where("status", "==", "OPEN").orderBy("from").get();
  const resActivities:   Array<Activity> = [];

  for await (const period of periodDocs.docs) {
    functions.logger.log("GET /activities/open - " + period.id + " (" + (new Date()).toLocaleDateString("sv-SE") + ")");
    const activityDocs = await activitiesCol
      .where("period", "==", period.id)
      .where("date",   ">=", (new Date()).toLocaleDateString("sv-SE")).get();
    for await (const activity of activityDocs.docs) { resActivities.push({ id: activity.id, ...activity.data() }); }
  }

  return res.status(200).json(resActivities);
});

// -------------
// POST ACTIVITY
// -------------
activityRoute.post("/activity", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.date        ||
      !req.body.startTime   ||
      !req.body.endTime     ||
      !req.body.color       ||
      !req.body.period      ||
      !req.body.description ||
      !req.body.assistantSlots)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"date\": ..., \"startTime\": ..., \"endTime\": ..., \"color\": ..., \"period\": ..., \"description\": ..., \"assistantSlots\": [...] }");
  }

  // TODO - Unique constraint check?

  let docId = ""; // Set from res.id
  const activityData: ActivityData = {
    date:                     req.body.date,
    weekday:                  getWeekday(req.body.date),
    startTime:                req.body.startTime,
    endTime:                  req.body.endTime,
    color:                    req.body.color,
    period:                   req.body.period,
    description:              req.body.description,
    type:                     req.body.type ? req.body.type : "",
    typeName:                 req.body.typeName ? req.body.typeName : "",
    availableToUsers:         !!req.body.availableToUsers,
    typelessSlots:            !!req.body.typelessSlots,
    assistantSlots:           req.body.assistantSlots,
    assistantAllocations:     [],
    acceptedActivityBookings: [],
  };

  // Init Assistant allocations to same array length as assistantSlots
  for (let i = 0; i < activityData.assistantSlots.length; i++) {
    activityData.assistantAllocations[i] = "0";
  }

  functions.logger.log("POST /activity by " + userid, activityData);
  const docRes = await activitiesCol.add(activityData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...activityData,
  });
});

// -------------
// PUT ACTIVITY
// -------------
activityRoute.put("/activity/:activityid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.date        ||
      !req.body.startTime   ||
      !req.body.endTime     ||
      !req.body.color       ||
      !req.body.period      ||
      !req.body.description ||
      !req.body.assistantSlots)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"date\": ..., \"startTime\": ..., \"endTime\": ..., \"color\": ..., \"period\": ..., \"description\": ..., \"assistantSlots\": [...] }");
  }

  // TODO - Unique constraint check?

  const docId: string = req.params.activityid;
  const activityData: ActivityData = {
    date:                     req.body.date,
    weekday:                  getWeekday(req.body.date),
    startTime:                req.body.startTime,
    endTime:                  req.body.endTime,
    color:                    req.body.color,
    period:                   req.body.period,
    description:              req.body.description,
    type:                     req.body.type ? req.body.type : "",
    typeName:                 req.body.typeName ? req.body.typeName : "",
    availableToUsers:         !!req.body.availableToUsers,
    typelessSlots:            !!req.body.typelessSlots,
    assistantSlots:           req.body.assistantSlots,
    assistantAllocations:     [],
    acceptedActivityBookings: [],
  };

  functions.logger.log("PUT /activity by " + userid, activityData);
  // Set everything EXCEPT assistantAllocations and acceptedBookings
  await activitiesCol.doc(docId).set({
      date:             activityData.date,
      weekday:          activityData.weekday,
      startTime:        activityData.startTime,
      endTime:          activityData.endTime,
      color:            activityData.color,
      period:           activityData.period,
      description:      activityData.description,
      type:             activityData.type,
      typeName:         activityData.typeName,
      availableToUsers: activityData.availableToUsers,
      typelessSlots:    activityData.typelessSlots,
      assistantSlots:   activityData.assistantSlots,     
    }, { merge: true });


  // UPDATE ACTIVITYBOOKINGS
  const activitybookingDocs = await activitybookingsCol.where("activity", "==", docId).get();

  for await (const activitybooking of activitybookingDocs.docs) {
    await activitybookingsCol.doc(activitybooking.id).set({
        activityDate:    activityData.date,
        activityWeekday: getWeekday(activityData.date),
        activityTime:    activityData.startTime + " - " + activityData.endTime,
        activityColor:   activityData.color,
      }, { merge: true });
  }

  return res.status(200).json({
    id: docId,
    ...activityData,
  });
});

// ---------------
// DELETE activity
// ---------------
activityRoute.delete("/activity/:activityid", async (req, res) => {
  const activityid: string = req.params.activityid;

  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  // DELETE ACTIVITYBOOKINGS
  const activitybookingsRef = await activitybookingsCol.where("activity", "==", activityid).get();
  activitybookingsRef.forEach((activitybooking) => { activitybooking.ref.delete(); });

  functions.logger.log("DELETE /activity/" + activityid + " by " + userid);
  await activitiesCol.doc(activityid).delete();

  return res.status(200).json({ });
});

// ---------------------
// DELETE ACTIVITY LIST
// ---------------------
activityRoute.delete("/activity", async (req, res) => {
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  const delactivityList: Array<Activity> = req.body.activityList;

  if (!delactivityList) {
    functions.logger.info("Incorrect body - " + req.body);
    return res.status(400).send("Incorrect body.\n Correct syntax is: { activityList: ... }");
  }

  functions.logger.log("DELETE /activity (list) by " + userid, delactivityList);

  // DELETE ACTIVITYBOOKINGS
  delactivityList.forEach( async (activity) =>  {
    if (activity.id) {
      const activitybookingsRef = await activitybookingsCol.where("activity", "==", activity.id).get();
      activitybookingsRef.forEach((activitybooking) => { activitybooking.ref.delete(); });
    }
  });

  // DELETE ACTIVITIES (separately to ensure consistency in client fetch)
  for await (const activity of delactivityList) {
    await activitiesCol.doc(activity.id).delete();
  }

  return res.status(200).json({ });
});

export {activityRoute};
