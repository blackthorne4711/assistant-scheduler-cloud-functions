import {Router}                   from "express";
import * as functions             from "firebase-functions";
import {getUserid, isUseridAdmin} from "../utils/useAuth";
import {timeslotsCol, periodsCol} from "../utils/useDb";
import {Timeslot, TimeslotData}   from "../types/Timeslot";
//import {Period}             from "../types/Period";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const timeslotRoute = Router();

// -------------
// GET TIMESLOT
// -------------
timeslotRoute.get("/timeslot/:timeslotid", async (req, res) => {
  const docId: string = req.params.timeslotid;

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
    await timeslotsCol.orderBy("startTime", "desc").get();

  timeslotDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resTimeslots.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resTimeslots);
});

// -----------------------------
// GET ALL TIMESLOTS FOR PERIOD
// -----------------------------
timeslotRoute.get("/timeslots/period/:periodid", async (req, res) => {
  const periodId:     string           = req.params.periodid;
  const resTimeslots: Array<Timeslot>  = [];
  const timeslotDocs =
    await timeslotsCol.where("period", "==", periodId).orderBy("startTime", "desc").get();

  timeslotDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resTimeslots.push({ id: doc.id, ...doc.data() });
  });

  return res.status(200).json(resTimeslots);
});

// -------------------------------------
// GET ALL OPEN (AND CURRENT) TIMESLOTS 
// -------------------------------------
timeslotRoute.get("/timeslots/open", async (req, res) => {
  const periodDocs = await periodsCol.where("status", "==", "OPEN").orderBy("from").get();
  //const openPeriodList: Array<Period>   = [];
  const resTimeslots:   Array<Timeslot> = [];

  for await (const period of periodDocs.docs) {
    functions.logger.log("GET /timeslots/open - " + period.id + ' (' + (new Date()).toLocaleDateString("sv-SE") + ')');

    const timeslotDocs = await timeslotsCol
      .where("period", "==", period.id)
      .where("date",   ">=", (new Date()).toLocaleDateString("sv-SE"))
      .orderBy("date").get();

    for await (const timeslot of timeslotDocs.docs) {
      //functions.logger.log("(GET /timeslots/open) - timeslot - " + timeslot.id);
      resTimeslots.push({ id: timeslot.id, ...timeslot.data() });
    }
  }

    // await Promise.all(timeslotDocs.docs.map(async (timeslot) => {
    //   functions.logger.log("(GET /timeslots/open) - timeslot - " + timeslot.id);
    //   resTimeslots.push({ id: timeslot.id, ...timeslot.data() });
    // }));
 // }));


  // for (const openPeriod of periodDocs.docs) {
  //   functions.logger.log("GET /timeslots/open - " + openPeriod.id);
  //   const timeslotDocs =
  //       await timeslotsCol.where("period", "==", openPeriod.id).orderBy("from").get();
  //   for (const openTimeslot of timeslotDocs.docs) {
  //       functions.logger.log("(GET /timeslots/open) - timeslot - " + openTimeslot.id);
  //       resTimeslots.push({ id: openTimeslot.id, ...openTimeslot.data() });
  //     }
  // }

  // periodDocs.forEach((doc: FirebaseFirestore.DocumentData) =>  {
  //   openPeriodList.push({ id: doc.id, ...doc.data() });
  // });

  // for (const openPeriod of openPeriodList) {
  //   functions.logger.log("GET /timeslots/open - " + openPeriod.name + " (" + openPeriod.id + ')');
  //   const timeslotDocs =
  //       await timeslotsCol.where("period", "==", openPeriod.id).orderBy("from").get();
  //   timeslotDocs.forEach((timeslot: FirebaseFirestore.DocumentData) => {
  //       functions.logger.log("(GET /timeslots/open) - timeslot - " + timeslot.id);
  //       resTimeslots.push({ id: timeslot.id, ...timeslot.data() });
  //     });
  // }

  functions.logger.log("GET /timeslots/open - DONE");

  // openPeriodList.forEach( async (openPeriod: Period) => {
  //   functions.logger.log("GET /timeslots/open - " + openPeriod.name + " (" + openPeriod.id + ')');
  //   const timeslotDocs =
  //       await timeslotsCol.where("period", "==", openPeriod.id).orderBy("from").get();
  //   timeslotDocs.forEach((timeslot: FirebaseFirestore.DocumentData) => {
  //       functions.logger.log("(GET /timeslots/open) - timeslot - " + timeslot.id);
  //       resTimeslots.push({ id: timeslot.id, ...timeslot.data() });
  //     });
  // })

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

  if (!req.body.date      ||
      !req.body.startTime ||
      !req.body.endTime   ||
      !req.body.period    ||
      !req.body.assistantSlots)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"date\": ..., \"startTime\": ..., \"endTime\": ..., \"period\": ... \"assistantSlots\": [...] }");
  }

  // TODO - Unique constraint check?

  let docId = ""; // Set from res.id
  const timeslotData: TimeslotData = {
    date:           req.body.date,
    startTime:      req.body.startTime,
    endTime:        req.body.endTime,
    period:         req.body.period,
    assistantSlots: req.body.assistantSlots,
  };

  if (req.body.fromSchedule)     { timeslotData.fromSchedule     = req.body.fromSchedule;     }
  if (req.body.fromScheduleName) { timeslotData.fromScheduleName = req.body.fromScheduleName; }
  if (req.body.description)      { timeslotData.description      = req.body.description;      }
  if (req.body.contact)          { timeslotData.contact          = req.body.contact;          }
  if (req.body.color)            { timeslotData.color            = req.body.color;            }
  if (req.body.type)             { timeslotData.type             = req.body.type;             }

  functions.logger.log("POST /timeslot by " + userid, timeslotData);
  const docRes = await timeslotsCol.add(timeslotData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...timeslotData,
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

  if (!req.body.date      ||
      !req.body.startTime ||
      !req.body.endTime   ||
      !req.body.period    ||
      !req.body.assistantSlots)
  {
    return res.status(400).send(
      "Incorrect body.\n Correct syntax is: { \"date\": ..., \"startTime\": ..., \"endTime\": ..., \"period\": ... \"assistantSlots\": [...] }");
  }

  // TODO - Unique constraint check?

  const docId: string = req.params.timeslotid;
  const timeslotData: TimeslotData = {
  date:           req.body.date,
  startTime:      req.body.startTime,
  endTime:        req.body.endTime,
  period:         req.body.period,
  assistantSlots: req.body.assistantSlots,
  };

  if (req.body.fromSchedule)     { timeslotData.fromSchedule     = req.body.fromSchedule;     }
  if (req.body.fromScheduleName) { timeslotData.fromScheduleName = req.body.fromScheduleName; }
  if (req.body.description)      { timeslotData.description      = req.body.description;      }
  if (req.body.contact)          { timeslotData.contact          = req.body.contact;          }
  if (req.body.color)            { timeslotData.color            = req.body.color;            }
  if (req.body.type)             { timeslotData.type             = req.body.type;             }

  functions.logger.log("PUT /timeslot by " + userid, timeslotData);
  await timeslotsCol.doc(docId).set(timeslotData);

  return res.status(200).json({
    id: docId,
    ...timeslotData,
  });
});

// -------------
// DELETE timeslot
// -------------
timeslotRoute.delete("/timeslot/:timeslotid", async (req, res) => {
  const docId: string = req.params.timeslotid;

  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  functions.logger.log("DELETE /timeslot/" + docId + " by " + userid);
  await timeslotsCol.doc(docId).delete();

  return res.status(200).json({ });
});

// ---------------------
// DELETE timeslot LIST
// ---------------------
timeslotRoute.delete("/timeslot", async (req, res) => {
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  const deltimeslotList: Array<Timeslot> = req.body.timeslotList;

  if (!deltimeslotList) {
    functions.logger.info("Incorrect body - " + req.body);
    return res.status(400).send("Incorrect body.\n Correct syntax is: { timeslotList: ... }");
  }

  functions.logger.log("DELETE /timeslot (list) by " + userid, deltimeslotList);

  deltimeslotList.forEach( async (timeslot) =>  {
    if (timeslot.id) {
      await timeslotsCol.doc(timeslot.id).delete();
    }
  });

  return res.status(200).json({ });
});

// -----------------------------------
// DELETE ALL TIMESLOTS FROM SCHEDULE
// -----------------------------------
timeslotRoute.delete("/timeslots/schedule/:scheduleid", async (req, res) => {
  const scheduleid: string = req.params.scheduleid;

  const userid = getUserid(req);
  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) { return res.status(403).json("Not allowed for non-admin"); }

  try {
    const timeslotsRef = await timeslotsCol.where("fromSchedule", "==", scheduleid).get();
    timeslotsRef.forEach((timeslot) => { timeslot.ref.delete(); });
  } catch (error) {
    return res.status(500).json({ status: "error", msg: "Error deleting timeslots for schedule - " + scheduleid, data: error });
  }

  return res.status(200).json({ });
});

export {timeslotRoute};
