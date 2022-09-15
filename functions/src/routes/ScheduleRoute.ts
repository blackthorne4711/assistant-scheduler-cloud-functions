import {Router} from "express";
import * as functions from "firebase-functions";
import {getUserid, isUseridAdmin} from "../utils/useAuth"
import {schedulesCol} from '../utils/useDb'
import {Schedule, ScheduleData} from "../types/Schedule"

const scheduleRoute = Router();

// -------------
// GET SCHEDULE
// -------------
scheduleRoute.get("/schedule/:scheduleid", async (req, res) => {
  const docId: string = req.params.scheduleid

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
  const periodId: string = req.params.periodid

  console.log(periodId)

  const resSchedules: Array<Schedule>  = [];

  const scheduleDocs =
    await schedulesCol.where('period', '==', periodId).orderBy("scheduleStartDate").get();

  scheduleDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resSchedules.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resSchedules);
});

// name:              string,

// scheduleStartDate: string, // YYYY-MM-DD
// scheduleEndDate:   string, // YYYY-MM-DD
// recurrenceDays:    string, // Number of days between each timeslot, e.g. 7 for weekly
// initStartDatetime: string, // YYYY-MM-DD HH24:MM:SS
// initEndDatetime:   string, // YYYY-MM-DD HH24:MM:SS

// period:            string, // For period status handling, e.g. only generate timeslots for OPEN period

// description?:      string, // Free text field for individual timeslot
// color?:            string, // For visualization in frontend
// type?:             string, // For filtering in frontend
// contact?:          string, // For info
// assistantSlots:    Array<number>, // Array of slots (number) in increasing assistant level

// ---------------
// POST SCHEDULE
// ---------------
scheduleRoute.post("/schedule", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if(!req.body.name              ||
     !req.body.scheduleStartDate ||
     !req.body.scheduleEndDate   ||
     !req.body.recurrenceDays    ||
     !req.body.initStartDatetime ||
     !req.body.initEndDatetime   ||
     !req.body.period            ||
     !req.body.assistantSlots)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { name: ..., scheduleStartDate: ..., scheduleEndDate: ..., recurrenceDays: ..., recurrenceDays: ..., initStartDatetime: ..., initEndDatetime: ..., period: ..., assistantSlots: [...], ... }");
  }

  let docId: string = '' // Set from res.id
  let scheduleData: ScheduleData = {
    name: req.body.name,
    scheduleStartDate: req.body.scheduleStartDate,
    scheduleEndDate: req.body.scheduleEndDate,
    recurrenceDays: req.body.recurrenceDays,
    initStartDatetime: req.body.initStartDatetime,
    initEndDatetime: req.body.initEndDatetime,
    period: req.body.period,
    assistantSlots: req.body.assistantSlots
  }

  if (req.body.description) { scheduleData.description = req.body.description; }
  if (req.body.color)       { scheduleData.color       = req.body.color;       }
  if (req.body.type)        { scheduleData.type        = req.body.type;        }
  if (req.body.contact)     { scheduleData.contact     = req.body.contact;     }

  functions.logger.log("POST /schedule by " + userid, scheduleData);
  const docRes = await schedulesCol.add(scheduleData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...scheduleData
  });
});

// ---------------
// PUT SCHEDULE
// ---------------
scheduleRoute.put("/schedule/:scheduleid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if(!req.body.name              ||
     !req.body.scheduleStartDate ||
     !req.body.scheduleEndDate   ||
     !req.body.recurrenceDays    ||
     !req.body.initStartDatetime ||
     !req.body.initEndDatetime   ||
     !req.body.period            ||
     !req.body.assistantSlots)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { name: ..., scheduleStartDate: ..., scheduleEndDate: ..., recurrenceDays: ..., recurrenceDays: ..., initStartDatetime: ..., initEndDatetime: ..., period: ..., assistantSlots: [...], ... }");
  }

  // TODO - Unique constraint check?

  let docId: string = req.params.scheduleid
  let scheduleData: ScheduleData = {
    name: req.body.name,
    scheduleStartDate: req.body.scheduleStartDate,
    scheduleEndDate: req.body.scheduleEndDate,
    recurrenceDays: req.body.recurrenceDays,
    initStartDatetime: req.body.initStartDatetime,
    initEndDatetime: req.body.initEndDatetime,
    period: req.body.period,
    assistantSlots: req.body.assistantSlots
  }

  if (req.body.description) { scheduleData.description = req.body.description; }
  if (req.body.color)       { scheduleData.color       = req.body.color;       }
  if (req.body.type)        { scheduleData.type        = req.body.type;        }
  if (req.body.contact)     { scheduleData.contact     = req.body.contact;     }

  functions.logger.log("PUT /schedule by " + userid, scheduleData);
  await schedulesCol.doc(docId).set(scheduleData);

  return res.status(200).json({
    id: docId,
    ...scheduleData
  });
});

export {scheduleRoute};
