import {Router} from "express";
import * as functions from "firebase-functions";
import {getUserid, isUseridAdmin} from "../utils/useAuth"
import {timeslotsCol} from '../utils/useDb'
import {Timeslot, TimeslotData} from "../types/Timeslot"

const timeslotRoute = Router();

// -------------
// GET TIMESLOT
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
// GET ALL TIMESLOTS
// ------------------
timeslotRoute.get("/timeslots", async (req, res) => {
  const resTimeslots: Array<Timeslot>  = [];

  const timeslotDocs =
    await timeslotsCol.orderBy("startDatetime").get();

  timeslotDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resTimeslots.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resTimeslots);
});

// -----------------------------
// GET ALL TIMESLOTS FOR PERIOD
// -----------------------------
timeslotRoute.get("/timeslots/period/:periodid", async (req, res) => {
  const periodId: string = req.params.periodid

  console.log(periodId)

  const resTimeslots: Array<Timeslot>  = [];

  const timeslotDocs =
    await timeslotsCol.where('period', '==', periodId).orderBy("startDatetime").get();

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

  if(!req.body.date ||
     !req.body.startDatetime ||
     !req.body.endDatetime ||
     !req.body.period ||
     !req.body.assistantSlots)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"date\": ..., \"startDatetime\": ..., \"endDatetime\": ..., \"period\": ... \"assistantSlots\": [...] }");
  }

  // TODO - Unique constraint check?

  let docId: string = '' // Set from res.id
  let timeslotData: TimeslotData = {
  date: req.body.date,
  startDatetime: req.body.startDatetime,
  endDatetime: req.body.endDatetime,
  period: req.body.period,
  assistantSlots: req.body.assistantSlots,
  };

  if (req.body.fromSchedule) { timeslotData.fromSchedule = req.body.fromSchedule; }
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

// -------------
// PUT TIMESLOT
// -------------
timeslotRoute.put("/timeslot/:timeslotid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if(!req.body.date ||
     !req.body.startDatetime ||
     !req.body.endDatetime ||
     !req.body.period ||
     !req.body.assistantSlots)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"date\": ..., \"startDatetime\": ..., \"endDatetime\": ..., \"period\": ... \"assistantSlots\": [...] }");
  }

  // TODO - Unique constraint check?

  let docId: string = req.params.timeslotid
  let timeslotData: TimeslotData = {
  date: req.body.date,
  startDatetime: req.body.startDatetime,
  endDatetime: req.body.endDatetime,
  period: req.body.period,
  assistantSlots: req.body.assistantSlots,
  };

  if (req.body.fromSchedule) { timeslotData.fromSchedule = req.body.fromSchedule; }
  if (req.body.description) { timeslotData.description = req.body.description; }
  if (req.body.contact) { timeslotData.contact = req.body.contact; }
  if (req.body.color) { timeslotData.color = req.body.color; }
  if (req.body.type) { timeslotData.type = req.body.type; }

  functions.logger.log("PUT /timeslot by " + userid, timeslotData);
  await timeslotsCol.doc(docId).set(timeslotData);

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
