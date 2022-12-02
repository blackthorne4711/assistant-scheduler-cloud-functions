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
const activityBookingRoute = Router();

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
        activity.acceptedActivityBookings.push(ActivityBooking.id);
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

    functions.logger.info("processActivityBookingRemoval TYPELESS=" + activity.typelessSlots + " (" + ActivityBooking.id, activity.assistantAllocations);
    if (activity.typelessSlots) {
      const allocatedInt = parseInt(activity.assistantAllocations[0]); // Typeless = first slot
      // Update allocation
      activity.assistantAllocations[0] = (allocatedInt-1).toString();  // Typeless = first slot
    } else {
      // TYPED - Use assistant type slots
      const assistantTypeInt = parseInt(ActivityBooking.assistantType);
      const allocatedInt = parseInt(activity.assistantAllocations[assistantTypeInt]);
      // Update allocation
      activity.assistantAllocations[assistantTypeInt] = (allocatedInt-1).toString();
    }

    // Remove ActivityBooking id from activity
    const index = activity.acceptedActivityBookings.indexOf(ActivityBooking.id);
    if (index > -1) { // Check if id was found in array
      activity.acceptedActivityBookings.splice(index, 1); // 2nd parameter means remove one item only
    }
    await activitiesCol.doc(activity.id).set(activity as ActivityData);

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

// ---------------------------------------------------------------------------------
// GET user ActivityBookings (i.e. for assistants for user and current/future dates)
// ---------------------------------------------------------------------------------
activityBookingRoute.get("/activitybookings/user", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const userid     = getUserid(req);
  const assistants = await getAssistantsForUser(userid);
  const periodDocs = await periodsCol.where("status", "==", "OPEN").orderBy("from").get();
  const resActivityBookings: Array<ActivityBooking>  = [];

  for await (const period of periodDocs.docs) {
    for (let i = 0; i < assistants.length; i++) {
      functions.logger.log("GET /activitybookings/user - assistant - " + assistants[i]);
      const ActivityBookingDocs =
        await activitybookingsCol
          .where("activityPeriod", "==", period.id)
          .where("assistant", "==", assistants[i]).get();
      ActivityBookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
        resActivityBookings.push({ id: doc.id, ...doc.data() });
      });
    }
  }

  return res.status(200).json(resActivityBookings);
});

// ---------------------------------------------
// GET open ActivityBookings (i.e. open periods) 
// ---------------------------------------------
activityBookingRoute.get("/activitybookings/open", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const periodDocs = await periodsCol.where("status", "==", "OPEN").orderBy("from").get();
  const resActivityBookings: Array<ActivityBooking> = [];

  for await (const period of periodDocs.docs) {
    functions.logger.log("GET /ActivityBookings/open - " + period.id + " (" + (new Date()).toLocaleDateString("sv-SE") + ")");

    const ActivityBookingDocs = await activitybookingsCol
      .where("activityPeriod", "==", period.id).get();

    for await (const ActivityBooking of ActivityBookingDocs.docs) {
      resActivityBookings.push({ id: ActivityBooking.id, ...ActivityBooking.data() });
    }
  }
  
  return res.status(200).json(resActivityBookings);
});

// --------------------------------------------------------
// GET all ActivityBookings for period (only Admin/Trainer)
// --------------------------------------------------------
activityBookingRoute.get("/activitybookings/period/:periodid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  // Authz validation (only Admin/Trainer)
  const userid = getUserid(req);
  const isAdmin:   boolean = await isUseridAdmin(userid);
  const isTrainer: boolean = await isUseridTrainer(userid);
  if (!isAdmin && !isTrainer) {
    functions.logger.error("GET /activitybookings/period/:periodid - not allowed - " + userid);
    return res.status(403).json("Not allowed for non-(admin/trainer)");
  }

  const periodId:     string           = req.params.periodid;
  const resActivityBookings: Array<ActivityBooking>  = [];
  const ActivityBookingDocs =
    await activitybookingsCol.where("activityPeriod", "==", periodId).get();
  ActivityBookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => { resActivityBookings.push({ id: doc.id, ...doc.data() }); });

  return res.status(200).json(resActivityBookings);
});

// --------------------
// POST ActivityBooking
// --------------------
activityBookingRoute.post("/activitybooking", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  const userid = getUserid(req); // TODO - error handling in getUserid

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

  const isAdmin = await isUseridAdmin(userid);

  // Activity availableToUsers check
  if (!isAdmin && !activityData.availableToUsers) {
    functions.logger.info("Not allowed (not availableToUsers, and not admin) - " + userid, activity);
    return res.status(403).json("Not allowed (not availableToUsers, and not admin)");
  }

  // Set (additional) ActivityBooking data
  ActivityBookingData.activityDate      = activityData.date;
  ActivityBookingData.activityWeekday   = getWeekday(activityData.date);
  ActivityBookingData.activityTime      = activityData.startTime + " - " + activityData.endTime;
  ActivityBookingData.activityColor     = activityData.color ? activityData.color : "";
  ActivityBookingData.activityPeriod    = activityData.period;
  ActivityBookingData.assistantType     = assistantData ? assistantData.type : "";
  ActivityBookingData.assistantFullname = assistantData ? assistantData.fullname : "";
  
  // Authorization validation
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
activityBookingRoute.put("/activitybooking/:activitybookingid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");

  const userid = getUserid(req); // TODO - error handling in getUserid

  const docId: string = req.params.activitybookingid;

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

  // Activity availableToUsers check
  if (!isAdmin && !activityData.availableToUsers) {
    functions.logger.info("Not allowed (not availableToUsers, and not admin) - " + userid, activity);
    return res.status(403).json("Not allowed (not availableToUsers, and not admin)");
  }

  ActivityBookingData.updatedBy       = userid;
  ActivityBookingData.updatedDatetime = (new Date()).toLocaleString("sv-SE");

  // UPDATE ActivityBooking
  await activitybookingsCol.doc(docId).set(ActivityBookingData);
  // PROCESS ActivityBooking
  if (ActivityBookingData.status == ActivityBookingStatus.REMOVED || (isAdmin && ActivityBookingData.status == ActivityBookingStatus.REJECTED)) {
    await processActivityBookingRemoval({ id: docId, ...ActivityBookingData});
  }
  // TODO - Handle Admin setting other status than REMOVED/REJECTED

  return res.status(200).json({
    id: docId,
    ...ActivityBookingData,
  });
});

export {activityBookingRoute};
