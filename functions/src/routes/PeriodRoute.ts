import {Router}                           from "express";
import * as functions                     from "firebase-functions";
import {getUserid, isUseridAdmin}         from "../utils/useAuth";
import {periodsCol,
        timeslotsCol,
        schedulesCol,
        bookingsCol}                      from "../utils/useDb";
import {Period, PeriodData, PeriodStatus} from "../types/Period";
// import {TimeslotData} from "../types/Timeslot"

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const periodRoute = Router();

// ----------
// GET PERIOD
// ----------
periodRoute.get("/period/:periodid", async (req, res) => {
  const docId: string = req.params.periodid;
  const periodDoc = await periodsCol.doc(docId).get();
  if (periodDoc.exists) {
    const periodData: PeriodData = periodDoc.data()!;
    return res.status(200).json({ id: docId, ...periodData });
  }

  return res.status(200).json({ });
});

// ---------------------
// GET PERIOD STATISTICS
// ---------------------
periodRoute.get("/period/:periodid/stats", async (req, res) => {
  const periodid: string = req.params.periodid;
  const periodDoc = await periodsCol.doc(periodid).get();
  if (periodDoc.exists) {
    let schedulesCount = 0;
    let timeslotsCount = 0;
    let bookingsCount  = 0;

    await schedulesCol.where("period", "==", periodid).get().then((snap) => {
      schedulesCount = snap.size;
    });

    await timeslotsCol.where("period", "==", periodid).get().then((snap) => {
      timeslotsCount = snap.size;
    });

    await bookingsCol.where("timeslotPeriod", "==", periodid).get().then((snap) => {
      bookingsCount = snap.size;
    });

    return res.status(200).json({ "schedules": schedulesCount, "timeslots": timeslotsCount, "bookings": bookingsCount });
  }

  return res.status(200).json({ });
});

// ---------------
// GET ALL PERIODS
// ---------------
periodRoute.get("/periods", async (req, res) => {
  const resPeriods: Array<Period>  = [];

  const periodDocs =
    await periodsCol.orderBy("from", "desc").get();

  periodDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resPeriods.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resPeriods);
});

// ----------------------------
// GET ALL PERIODS WITH STATUS
// ----------------------------
periodRoute.get("/periods/status/:status", async (req, res) => {
  const status: string = req.params.status;

  const resPeriods: Array<Period>  = [];

  const periodDocs =
    await periodsCol.where("status", "==", status).orderBy("from", "desc").get();

  periodDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resPeriods.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resPeriods);
});

// -----------
// POST PERIOD
// -----------
periodRoute.post("/period", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.name ||
      !req.body.from ||
      !req.body.to) {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { name: ..., from: ..., to: ..., description?: ...}");
  }

  // if(!Object.values(PeriodStatus).includes(req.body.status)) {
  //   functions.logger.error("POST /period incorrect status", req.body.status);
  //   return res.status(400).send("Incorrect status");
  // }

  try {
    const nowDate = new Date();
    const fromDate = new Date(req.body.from);
    const toDate = new Date(req.body.to);
    if (fromDate.getTime() !== fromDate.getTime()) {
      throw new Error("Invalid date in \"from\"");
    }
    if (toDate.getTime() !== toDate.getTime()) {
      throw new Error("Invalid date in \"to\"");
    }
    if (fromDate.getFullYear() < nowDate.getFullYear() ||
       toDate.getFullYear() < nowDate.getFullYear()) {
      throw new Error("Year for from or to < current year");
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw new Error("Invalid dates - from after to");
    }
  } catch (error) {
    if (error instanceof Error) {
      functions.logger.error("POST /period - invalid from/to unix timestamp - " + error.message);
      return res.status(400).send("Invalid from/to unix timestamp - " + error.message);
    } else {
      functions.logger.error("POST /period - invalid from/to unix timestamp");
      return res.status(400).send("Invalid from/to unix timestamp");
    }
  }

  // TODO - Unique constraint check?

  let docId: string = ""; // Set from res.id
  const periodData: PeriodData = {
    name:   req.body.name,
    from:   req.body.from,
    to:     req.body.to,
    status: PeriodStatus.PREPARE,
  };

  if (req.body.description) { periodData.description = req.body.description; }

  functions.logger.log("POST /period by " + userid, periodData);
  const docRes = await periodsCol.add(periodData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...periodData,
  });
});

// ----------
// PUT PERIOD
// ----------
periodRoute.put("/period/:periodid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.name ||
      !req.body.from ||
      !req.body.to   ||
      !req.body.status) {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { name: ..., from: ..., to: ..., status: ..., description?: ...}");
  }

  try {
    const nowDate = new Date();
    const fromDate = new Date(req.body.from);
    const toDate = new Date(req.body.to);
    if (fromDate.getTime() !== fromDate.getTime()) {
      throw new Error("Invalid date in \"from\"");
    }
    if (toDate.getTime() !== toDate.getTime()) {
      throw new Error("Invalid date in \"to\"");
    }
    if (fromDate.getFullYear() < nowDate.getFullYear() ||
       toDate.getFullYear() < nowDate.getFullYear()) {
      throw new Error("Year for from or to < current year");
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw new Error("Invalid dates - from after to");
    }
  } catch (error) {
    if (error instanceof Error) {
      functions.logger.error("PUT /period - invalid from/to unix timestamp - " + error.message);
      return res.status(400).send("Invalid from/to unix timestamp - " + error.message);
    } else {
      functions.logger.error("PUT /period - invalid from/to unix timestamp");
      return res.status(400).send("Invalid from/to unix timestamp");
    }
  }

  // TODO - Unique constraint check?

  const docId: string = req.params.periodid;
  const periodData: PeriodData = {
    name:   req.body.name,
    from:   req.body.from,
    to:     req.body.to,
    status: req.body.status,
  };

  if (req.body.description) { periodData.description = req.body.description; }

  functions.logger.log("PUT /period by " + userid, periodData);
  await periodsCol.doc(docId).set(periodData);

  return res.status(200).json({
    id: docId,
    ...periodData,
  });
});

// -------------
// DELETE period
// -------------
periodRoute.delete("/period/:periodid", async (req, res) => {
  const periodid: string = req.params.periodid;

  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  // DELETE TIMESLOTS
  const timeslotsRef = await timeslotsCol.where("period", "==", periodid).get();
  for await (const timeslot of timeslotsRef.docs) {
    // DELETE BOOKINGS
    const bookingsRef = await bookingsCol.where("timeslot", "==", timeslot.id).get();
    bookingsRef.forEach((booking) => { booking.ref.delete(); });
    // DELETE TIMESLOT
    timeslot.ref.delete();
  }

  // DELETE SCHEDULES
  try {
    const schedulesRef = await schedulesCol.where("period", "==", periodid).get();
    schedulesRef.forEach((schedule) => { schedule.ref.delete(); });
  } catch (error) {
    return res.status(500).json({ status: "error", msg: "Error deleting schedules for period - " + periodid, data: error });
  }

  functions.logger.log("DELETE /period/" + periodid + " by " + userid);
  await periodsCol.doc(periodid).delete();

  return res.status(200).json({ });
});

export {periodRoute};
