import {Router} from "express";
import * as functions from "firebase-functions";
import {getUserid, isUseridAdmin} from "../utils/useAuth"
import {timeslotsCol} from '../utils/useDb'
import {Timeslot, TimeslotData} from "../types/Timeslot"
//import {PeriodData} from "../types/Period"

const timeslotRoute = Router();

// -------------
// GET TIMTESLOT
// -------------
timeslotRoute.get("/timeslot/:timeslotid", async (req, res) => {
  const docId: string = req.params.timeslotid

  const timeslotDoc = await timeslotsCol.doc(docId).get();
  if (timeslotDoc.exists) {
    const timeslotData: TimeslotData = timeslotDoc.data()!;
    return res.status(200).json({ id: docId, ...timeslotData });
  }

  return res.status(200).json({ });
});

// ------------------
// GET ALL TIMTESLOTS
// ------------------
timeslotRoute.get("/timeslots", async (req, res) => {
  const resTimeslots: Array<Timeslot>  = [];

  const timeslotDocs =
    await timeslotsCol.orderBy("from").get();

  timeslotDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resTimeslots.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resTimeslots);
});

// -------------
// POST TIMESLOT
// -------------
timeslotRoute.post("/timeslot", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  // name: string, // 
  // startDatetime: number,
  // endDatetime: number,
  // durationInHours: number, // I.e. 4,5
  // timeDesc: string, // I.e. 08:00-12:30
  // weekday: string,
  // period: string,
  // fromSchedule?: string,
  // description?: string, // Free text field for individual timeslot
  // color?: string, // For visualization in frontend
  // type?: string, // For filtering in frontend
  // contact?: string, // For info

  if(!req.body.name ||
     !req.body.startdatetime ||
     !req.body.enddatetime ||
     !req.body.durationinhours ||
     !req.body.timedesc ||
     !req.body.weekday ||
     !req.body.period)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"name\": ..., \"startdatetime\": ..., \"enddatetime\": ..., \"durationinhours\": ..., \"timedesc\": ..., \"weekday\": ..., \"period\": ...}");
  }

  // TODO - Unique constraint check?

  let docId: string = '' // Set from res.id
  let timeslotData: TimeslotData = {
  name: req.body.name,
  startDatetime: req.body.startdatetime,
  endDatetime: req.body.enddatetime,
  durationInHours: req.body.durationinhours,
  weekday: req.body.weekday,
  period: req.body.period,
  };

  if (req.body.timedesc) { timeslotData.timeDesc = req.body.timeDesc; }
  if (req.body.fromschedule) { timeslotData.fromSchedule = req.body.fromSchedule; }
  if (req.body.description) { timeslotData.description = req.body.description; }
  if (req.body.contact) { timeslotData.contact = req.body.contact; }
  if (req.body.color) { timeslotData.color = req.body.color; }
  if (req.body.type) { timeslotData.type = req.body.type; }

  functions.logger.log("POST /timeslot by " + userid, timeslotData);
  const docRes = await timeslotsCol.add(timeslotData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...timeslotData
  });
});

// ---------------
// DELETE TIMESLOT
// ---------------
timeslotRoute.delete("/timeslot/:timeslotid", async (req, res) => {
  const docId: string = req.params.timeslotid;

  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  await timeslotsCol.doc(docId).delete();

  return res.status(200).json({ });
});

export {timeslotRoute};
