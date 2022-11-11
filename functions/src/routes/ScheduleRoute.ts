import {Router}                   from "express";
import * as functions             from "firebase-functions";
import {getUserid, isUseridAdmin} from "../utils/useAuth";
import {schedulesCol}             from "../utils/useDb";
import {Schedule, ScheduleData}   from "../types/Schedule";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const scheduleRoute = Router();

// -------------
// GET SCHEDULE
// -------------
scheduleRoute.get("/schedule/:scheduleid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const docId: string = req.params.scheduleid;

  const scheduleDoc = await schedulesCol.doc(docId).get();
  if (scheduleDoc.exists) {
    const scheduleData: ScheduleData= scheduleDoc.data()!;
    return res.status(200).json({ id: docId, ...scheduleData });
  }

  return res.status(200).json({ });
});

// ------------------
// GET ALL SCHEDULES
// ------------------
scheduleRoute.get("/schedules", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const resSchedules: Array<Schedule>  = [];

  const scheduleDocs =
    await schedulesCol.orderBy("scheduleStartDate").get();

  scheduleDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resSchedules.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resSchedules);
});

// -----------------------------
// GET ALL SCHEDULES FOR PERIOD
// -----------------------------
scheduleRoute.get("/schedules/period/:periodid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const periodId: string = req.params.periodid;
  const resSchedules: Array<Schedule>  = [];
  const scheduleDocs =
    await schedulesCol.where("period", "==", periodId).orderBy("scheduleStartDate").get();

  scheduleDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resSchedules.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resSchedules);
});

// ---------------
// POST SCHEDULE
// ---------------
scheduleRoute.post("/schedule", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.name              ||
      !req.body.scheduleStartDate ||
      !req.body.scheduleEndDate   ||
      !req.body.recurrenceDays    ||
      !req.body.startTime         ||
      !req.body.endTime           ||
      !req.body.period            ||
      !req.body.assistantSlots)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { name: ..., scheduleStartDate: ..., scheduleEndDate: ..., recurrenceDays: ..., recurrenceDays: ..., startTime: ..., endTime: ..., period: ..., assistantSlots: [...], ... }");
  }

  let docId = ""; // Set from res.id
  const scheduleData: ScheduleData = {
    name:              req.body.name,
    scheduleStartDate: req.body.scheduleStartDate,
    scheduleEndDate:   req.body.scheduleEndDate,
    recurrenceDays:    req.body.recurrenceDays,
    startTime:         req.body.startTime,
    endTime:           req.body.endTime,
    period:            req.body.period,
    assistantSlots:    req.body.assistantSlots,
  };

  if (req.body.description) { scheduleData.description = req.body.description; }
  if (req.body.color)       { scheduleData.color       = req.body.color;       }
  if (req.body.type)        { scheduleData.type        = req.body.type;        }
  if (req.body.contact)     { scheduleData.contact     = req.body.contact;     }

  functions.logger.log("POST /schedule by " + userid, scheduleData);
  const docRes = await schedulesCol.add(scheduleData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...scheduleData,
  });
});

// ---------------
// PUT SCHEDULE
// ---------------
scheduleRoute.put("/schedule/:scheduleid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.name              ||
      !req.body.scheduleStartDate ||
      !req.body.scheduleEndDate   ||
      !req.body.recurrenceDays    ||
      !req.body.startTime         ||
      !req.body.endTime           ||
      !req.body.period            ||
      !req.body.assistantSlots)
  {
    functions.logger.info("Incorrect body - " +req.body);
    return res.status(400).send("Incorrect body.\n Correct syntax is: { name: ..., scheduleStartDate: ..., scheduleEndDate: ..., recurrenceDays: ..., recurrenceDays: ..., startTime: ..., endTime: ..., period: ..., assistantSlots: [...], ... }");
  }

  // TODO - Unique constraint check?

  const docId: string = req.params.scheduleid;
  const scheduleData: ScheduleData = {
    name:              req.body.name,
    scheduleStartDate: req.body.scheduleStartDate,
    scheduleEndDate:   req.body.scheduleEndDate,
    recurrenceDays:    req.body.recurrenceDays,
    startTime:         req.body.startTime,
    endTime:           req.body.endTime,
    period:            req.body.period,
    assistantSlots:    req.body.assistantSlots,
  };

  if (req.body.description) { scheduleData.description = req.body.description; }
  if (req.body.color)       { scheduleData.color       = req.body.color;       }
  if (req.body.type)        { scheduleData.type        = req.body.type;        }
  if (req.body.contact)     { scheduleData.contact     = req.body.contact;     }

  functions.logger.log("PUT /schedule by " + userid, scheduleData);
  await schedulesCol.doc(docId).set(scheduleData);

  return res.status(200).json({
    id: docId,
    ...scheduleData,
  });
});

// -------------
// DELETE SCHEDULE
// -------------
scheduleRoute.delete("/schedule/:scheduleid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const docId: string = req.params.scheduleid;

  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  functions.logger.log("DELETE /schedule/" + docId + " by " + userid);
  await schedulesCol.doc(docId).delete();

  return res.status(200).json({ });
});

// ---------------------
// DELETE SCHEDULE LIST
// ---------------------
scheduleRoute.delete("/schedule", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  const delScheduleList: Array<Schedule> = req.body.scheduleList;

  if (!delScheduleList) {
    functions.logger.info("Incorrect body - " + req.body);
    return res.status(400).send("Incorrect body.\n Correct syntax is: { scheduleList: ... }");
  }

  functions.logger.log("DELETE /schedule (list) by " + userid, delScheduleList);

  // DELETE SCHEDULES
  for await (const schedule of delScheduleList) {
    await schedulesCol.doc(schedule.id).delete();
  }

  return res.status(200).json({ });
});

export {scheduleRoute};
