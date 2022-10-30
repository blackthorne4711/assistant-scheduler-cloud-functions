import {Router}                                               from "express";
import * as functions                                         from "firebase-functions";
import {getUserid,
        isUseridAdmin,
        isUseridTrainer,
        isUserForAssistant}                                   from "../utils/useAuth";
import {activitybookingsCol, activitiesCol, periodsCol, assistantsCol} from "../utils/useDb";
import {ActivityBooking, ActivityBookingData, ActivityBookingStatus}  from "../types/ActivityBooking";
import {PeriodStatus}                                         from "../types/Period";
import {Activity, ActivityData}                               from "../types/Activity";
import {getAssistantsForUser}                                 from "../routes/UserRoute";

// Import helper functions
import { getWeekday } from "../utils/helperfunctions";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const ActivityBookingRoute = Router();

// --------------------------
// ActivityBooking PROCESSING
// --------------------------
async function processActivityBookingRequest(ActivityBooking: ActivityBooking) {
  const activityId  = ActivityBooking.activity;
  const activityDoc = await activitiesCol.doc(activityId).get();
  if (activityDoc.exists) {
    const activity: Activity = { id: activityId, ...activityDoc.data()! };

    if (activity.typelessSlots) {
      // TYPELESS - No separation of assistant type
      const availableInt = parseInt(activity.assistantSlots[0]);        // Typeless = first slot
      const allocatedInt = parseInt(activity.assistantAllocations[0]);  // Typeless = first slot

      if (availableInt > 0 && allocatedInt < availableInt) {
        // Update activity with allocation (and add ActivityBooking id)
        activity.assistantAllocations[0] = (allocatedInt+1).toString(); // Typeless = first slot
        await activitiesCol.doc(activity.id).set(activity as ActivityData);

        // Update ActivityBooking with status ACCEPTED
        ActivityBooking.status = ActivityBookingStatus.ACCEPTED;
        await activitybookingsCol.doc(ActivityBooking.id).set(ActivityBooking as ActivityBookingData);
      } else {
        // Reject ActivityBooking with message
        ActivityBooking.status = ActivityBookingStatus.REJECTED;
        ActivityBooking.statusMessage = "No available assistant slots (typeless)";
        await activitybookingsCol.doc(ActivityBooking.id).set(ActivityBooking as ActivityBookingData);
      } // END TYPELESS
    } else {
      // TYPED - Use assistant type slots
      const assistantTypeInt = parseInt(ActivityBooking.assistantType);
      const availableSlotInt = parseInt(activity.assistantSlots[assistantTypeInt]);
      const allocatedSlotInt = parseInt(activity.assistantAllocations[assistantTypeInt]);

      if (availableSlotInt > 0 && allocatedSlotInt < availableSlotInt) {
        // Update activity with allocation (and add ActivityBooking id)
        activity.assistantAllocations[assistantTypeInt] = (allocatedSlotInt+1).toString();
        activity.acceptedActivityBookings.push(ActivityBooking.id);
        await activitiesCol.doc(activity.id).set(activity as ActivityData);

        // Update ActivityBooking with status ACCEPTED
        ActivityBooking.status = ActivityBookingStatus.ACCEPTED;
        await activitybookingsCol.doc(ActivityBooking.id).set(ActivityBooking as ActivityBookingData);
      } else {
        // Reject ActivityBooking with message
        ActivityBooking.status = ActivityBookingStatus.REJECTED;
        ActivityBooking.statusMessage = "No available assistant slots (" + ActivityBooking.assistantType + ")";
        await activitybookingsCol.doc(ActivityBooking.id).set(ActivityBooking as ActivityBookingData);
      } 
    } // END TYPED
  } else {
    // Reject ActivityBooking with (internal) error message
    functions.logger.error("Activity not found in processActivityBookingRequest (" + ActivityBooking.activity + ")");
    ActivityBooking.status = ActivityBookingStatus.REJECTED;
    ActivityBooking.statusMessage = "Internal error, activity not found (" + ActivityBooking.activity + ")";
    await activitybookingsCol.doc(ActivityBooking.id).set(ActivityBooking as ActivityBookingData);
  }
    
  return ActivityBooking.status;
}
 
export async function processActivityBookingRemoval(ActivityBooking: ActivityBooking) {
  const activityId  = ActivityBooking.activity;
  const activityDoc = await activitiesCol.doc(activityId).get();
  if (activityDoc.exists) {
    const activity: Activity = { id: activityId, ...activityDoc.data()! };

    if (activity.typelessSlots) {
      // TYPELESS - No separation of assistant type
      const allocatedInt = parseInt(activity.assistantAllocations[0]);    // Typeless = first slot
      // Update allocation
      activity.assistantAllocations[0] = (allocatedInt-1).toString(); // Typeless = first slot
      await activitiesCol.doc(activity.id).set(activity as ActivityData);
    } else {
      // TYPED - Use assistant type slots
      const assistantTypeInt = parseInt(ActivityBooking.assistantType);
      const allocatedSlotInt = parseInt(activity.assistantAllocations[assistantTypeInt]);
      // Update allocation
      activity.assistantAllocations[assistantTypeInt] = (allocatedSlotInt-1).toString();
      { // Remove ActivityBooking id from activity
        const index = activity.acceptedActivityBookings.indexOf(ActivityBooking.id);
        if (index > -1) { // Check if id was found in array
          activity.acceptedActivityBookings.splice(index, 1); // 2nd parameter means remove one item only
        }
      }
      await activitiesCol.doc(activity.id).set(activity as ActivityData);
    }

    // Update ActivityBooking with status REMOVED
    ActivityBooking.status = ActivityBookingStatus.REMOVED;
    await activitybookingsCol.doc(ActivityBooking.id).set(ActivityBooking as ActivityBookingData);
  } else {
    // Activity not found - Just remove ActivityBooking
    functions.logger.error("Activity not found in processActivityBookingRemoval (" + ActivityBooking.activity + ")");
    ActivityBooking.status = ActivityBookingStatus.REMOVED;
    await activitybookingsCol.doc(ActivityBooking.id).set(ActivityBooking as ActivityBookingData);
  }
}

// -------------
// GET ActivityBooking
// -------------
ActivityBookingRoute.get("/ActivityBooking/:ActivityBookingid", async (req, res) => {
  const docId: string = req.params.ActivityBookingid;
  const ActivityBookingDoc = await activitybookingsCol.doc(docId).get();
  if (ActivityBookingDoc.exists) {
    const ActivityBookingData: ActivityBookingData = ActivityBookingDoc.data()!;
    return res.status(200).json({ id: docId, ...ActivityBookingData });
  }
  return res.status(200).json({ });
});

// ------------------
// GET ALL ActivityBookingS
// ------------------
ActivityBookingRoute.get("/ActivityBookings", async (req, res) => {
  const userid = getUserid(req);
  const isAdmin:   boolean = await isUseridAdmin(userid);
  const isTrainer: boolean = await isUseridTrainer(userid);

  if (!isAdmin && !isTrainer) {
    functions.logger.error("GET /ActivityBookings - not allowed - " + userid);
    return res.status(403).json("Not allowed for non-(admin/trainer)");
  }

  const resActivityBookings: Array<ActivityBooking>  = [];
  const ActivityBookingDocs = await activitybookingsCol.orderBy("activity").orderBy("assistant").get();
  ActivityBookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => { resActivityBookings.push({ id: doc.id, ...doc.data() }); });
  return res.status(200).json(resActivityBookings);
});

// ---------------------------------------------------------------------
// GET ALL UPCOMING ActivityBookingS (current and future ActivityBookings)
// ---------------------------------------------------------------------
ActivityBookingRoute.get("/ActivityBookings/upcoming", async (req, res) => {
  const userid = getUserid(req);
  const isAdmin:   boolean = await isUseridAdmin(userid);
  const isTrainer: boolean = await isUseridTrainer(userid);

  if (!isAdmin && !isTrainer) {
    functions.logger.error("GET /ActivityBookings/upcoming - not allowed - " + userid);
    return res.status(403).json("Not allowed for non-(admin/trainer)");
  }

  const resActivityBookings: Array<ActivityBooking>  = [];
  const ActivityBookingDocs = await activitybookingsCol.where("activityDate", ">=", (new Date()).toLocaleDateString("sv-SE")).get();
  ActivityBookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resActivityBookings.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resActivityBookings);
});

// ---------------------------------------------------------------------
// GET ALL USER ActivityBookingS (i.e. for assistants for user and current dates)
// ---------------------------------------------------------------------
ActivityBookingRoute.get("/ActivityBookings/user", async (req, res) => {
  const userid     = getUserid(req);
  const assistants = await getAssistantsForUser(userid);

  const resActivityBookings: Array<ActivityBooking>  = [];

  for (let i = 0; i < assistants.length; i++) {
    functions.logger.log("GET /ActivityBookings/user - assistant - " + assistants[i]);
    const ActivityBookingDocs =
      await activitybookingsCol.where("activityDate", ">=", (new Date()).toLocaleDateString("sv-SE")).where("assistant", "==", assistants[i]).get();
    ActivityBookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => { resActivityBookings.push({ id: doc.id, ...doc.data() }); });
  }
  
  return res.status(200).json(resActivityBookings);
});

// -----------------------------
// GET ALL ActivityBookingS FOR PERIOD
// -----------------------------
ActivityBookingRoute.get("/ActivityBookings/period/:periodid", async (req, res) => {
  const periodId:     string           = req.params.periodid;
  const resActivityBookings: Array<ActivityBooking>  = [];
  const ActivityBookingDocs =
    await activitybookingsCol.where("activityPeriod", "==", periodId).get();
  ActivityBookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => { resActivityBookings.push({ id: doc.id, ...doc.data() }); });

  return res.status(200).json(resActivityBookings);
});

// ------------------------------
// GET ALL ActivityBookingS FOR ACTIVITY
// ------------------------------
ActivityBookingRoute.get("/ActivityBookings/activity/:activityid", async (req, res) => {
  const activityId: string = req.params.activityid;
  const resActivityBookings: Array<ActivityBooking>  = [];

  const ActivityBookingDocs =
    await activitybookingsCol.where("activity", "==", activityId).orderBy("activity").orderBy("assistant").get();
  ActivityBookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => { resActivityBookings.push({ id: doc.id, ...doc.data() }); });
  
  return res.status(200).json(resActivityBookings);
});

// -------------------------------------
// GET ALL OPEN (AND CURRENT) ActivityBookingS 
// -------------------------------------
ActivityBookingRoute.get("/ActivityBookings/open", async (req, res) => {
  const periodDocs = await periodsCol.where("status", "==", "OPEN").orderBy("from").get();
  const resActivityBookings: Array<ActivityBooking> = [];

  for await (const period of periodDocs.docs) {
    functions.logger.log("GET /ActivityBookings/open - " + period.id + " (" + (new Date()).toLocaleDateString("sv-SE") + ")");

    const ActivityBookingDocs = await activitybookingsCol
      .where("activityPeriod", "==", period.id)
      .where("activityDate",   ">=", (new Date()).toLocaleDateString("sv-SE")).get();

    for await (const ActivityBooking of ActivityBookingDocs.docs) {
      resActivityBookings.push({ id: ActivityBooking.id, ...ActivityBooking.data() });
    }
  }

  return res.status(200).json(resActivityBookings);
});

// --------------------
// POST ActivityBooking
// --------------------
ActivityBookingRoute.post("/ActivityBooking", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  if (!req.body.activity ||
      !req.body.assistant)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { activity: ..., assistant: ..., ... }");
  }

  let docId: string = ""; // Set from res.id
  const ActivityBookingData: ActivityBookingData = {
    activity:          req.body.activity,
    activityDate:      "", // TO BE UPDATED
    activityWeekday:   "", // TO BE UPDATED
    activityTime:      "", // TO BE UPDATED
    activityColor:     "", // TO BE UPDATED
    activityPeriod:    "", // TO BE UPDATED
    assistant:         req.body.assistant,
    assistantType:     "", // TO BE UPDATED
    assistantFullname: "", // TO BE UPDATED
    bookedBy:          userid,
    bookedDatetime:    (new Date()).toLocaleString("sv-SE"),
    comment:           req.body.comment,
    status:            ActivityBookingStatus.REQUESTED, // TODO - Possibly allow Admin to set other status? 
  };

  // Activity validation
  const activity = await activitiesCol.doc(ActivityBookingData.activity).get();
  if (!activity.exists) {
    return res.status(406).json("Activity not found");
  }
  const activityData = activity.data();
  if (!activityData) {
    functions.logger.error("Activity data undefined", activity);
    return res.status(500).json("Activity data not defined");
  }
  // TODO - Availability of Activity? Or handle in frontend + Status on ActivityBooking?

  // Activity - Period validation
  const period = await periodsCol.doc(activityData.period).get();
  if (!period.exists) {
    return res.status(500).json("Period not found for Activity");
  }
  const periodData = period.data();
  if (!periodData) {
    functions.logger.error("Period data undefined", period);
    return res.status(500).json("Period data not defined");
  }
  if (periodData.status != PeriodStatus.OPEN) {
    return res.status(406).json("Period is not open");
  }

  // Assistant validation
  const assistant = await assistantsCol.doc(ActivityBookingData.assistant).get();
  if (!assistant.exists) {
    return res.status(500).json("Assistant not found");
  }
  const assistantData = assistant.data();

  // Set (additional) ActivityBooking data
  ActivityBookingData.activityDate      = activityData.date;
  ActivityBookingData.activityWeekday   = getWeekday(activityData.date);
  ActivityBookingData.activityTime      = activityData.startTime + " - " + activityData.endTime;
  ActivityBookingData.activityColor     = activityData.color ? activityData.color : "";
  ActivityBookingData.activityPeriod    = activityData.period;
  ActivityBookingData.assistantType     = assistantData ? assistantData.type : "";
  ActivityBookingData.assistantFullname = assistantData ? assistantData.fullname : "";
  
  // Authorization validation
  const isAdmin = await isUseridAdmin(userid);
  if (isAdmin || await isUserForAssistant(userid, ActivityBookingData.assistant)) {
    functions.logger.log("ActivityBooking by " + userid + " for " + ActivityBookingData.assistant + "(" + ActivityBookingData.status + ")", ActivityBookingData);
    const docRes = await activitybookingsCol.add(ActivityBookingData);
    docId = docRes.id;

    // PROCESS ActivityBooking
    await processActivityBookingRequest({id: docId, ...ActivityBookingData});
    // TODO - get feedback on ActivityBooking processing
  } else {
    return res.status(403).json("Not allowed (not user for assistant, and not admin)");
  }

  return res.status(200).json({
    id: docId,
    ...ActivityBookingData,
  });
});

// --------------------------------------------------
// PUT ActivityBooking
// - (isUserForAssistant) - ONLY ALLOW STATUS REMOVED
// - (ONLY ADMIN)         - ALLOW STATUS TO BE SET
// --------------------------------------------------
ActivityBookingRoute.put("/ActivityBooking/:ActivityBookingid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const docId: string = req.params.ActivityBookingid;

  // Fetch existing ActivityBooking
  const ActivityBookingDoc = await activitybookingsCol.doc(docId).get();
  if (!ActivityBookingDoc.exists) {
    return res.status(400).send("ActivityBooking does not exists - " + docId);
  }
  const ActivityBookingData: ActivityBookingData = ActivityBookingDoc.data()!;

  // Authorization validation
  const isAdmin = await isUseridAdmin(userid);
  if (isAdmin || await isUserForAssistant(userid, ActivityBookingData.assistant)) {
    // ALLOWED - Admin or isUserForAssistant
    if (req.body.comment) { ActivityBookingData.comment = req.body.comment; }

    // ALLOWED - Admin or isUserForAssistant (only REMOVED)
    if (req.body.status && (isAdmin || req.body.status == ActivityBookingStatus.REMOVED)) {
      ActivityBookingData.status = req.body.status;
      // ALLOWED - Admin or isUserForAssistant (above)
      if (req.body.statusMessage) { ActivityBookingData.statusMessage = req.body.statusMessage; }
    }
  } else {
    return res.status(403).json("Not allowed (not user for assistant, and not admin)");
  }

  // Activity validation (to check Period below)
  const activity = await activitiesCol.doc(ActivityBookingData.activity).get();
  if (!activity.exists) {
    functions.logger.error("Activity not found", ActivityBookingData.activity);
    return res.status(500).json("Activity not found");
  }
  const activityData = activity.data();
  if (!activityData) {
    functions.logger.error("Activity data undefined", activity);
    return res.status(500).json("Activity data not defined");
  }

  // Period validation
  const period = await periodsCol.doc(activityData.period).get();
  if (!period.exists) {
    functions.logger.error("Period not found for Activity", activityData.period);
    return res.status(500).json("Period not found for Activity");
  }
  const periodData = period.data();
  if (!periodData) {
    functions.logger.error("Period data undefined", period);
    return res.status(500).json("Period data not defined");
  }
  if (periodData.status != PeriodStatus.OPEN) {
    return res.status(406).json("Period is not open");
  }

  ActivityBookingData.updatedBy       = userid;
  ActivityBookingData.updatedDatetime = (new Date()).toLocaleString("sv-SE");

  // UPDATE ActivityBooking
  await activitybookingsCol.doc(docId).set(ActivityBookingData);
  // PROCESS ActivityBooking
  if (ActivityBookingData.status == ActivityBookingStatus.REMOVED || (isAdmin && ActivityBookingData.status == ActivityBookingStatus.REJECTED)) {
    processActivityBookingRemoval({ id: docId, ...ActivityBookingData});
  }
  // TODO - Handle Admin setting other status than REMOVED/REJECTED

  return res.status(200).json({
    id: docId,
    ...ActivityBookingData,
  });
});

export {ActivityBookingRoute};
