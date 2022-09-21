import {Router}                                                         from "express";
import * as functions                                                   from "firebase-functions";
import {getUserid, isUseridAdmin, isUserForAssistant, getAssistantType} from "../utils/useAuth";
import {bookingsCol, timeslotsCol, periodsCol}                          from "../utils/useDb";
import {Booking, BookingData, BookingStatus}                            from "../types/Booking";
import {PeriodStatus}                                                   from "../types/Period";
// import {TimeslotData} from "../types/Timeslot"

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const bookingRoute = Router();

// -------------
// GET BOOKING
// -------------
bookingRoute.get("/booking/:bookingid", async (req, res) => {
  const docId: string = req.params.bookingid;
  const bookingDoc = await bookingsCol.doc(docId).get();
  if (bookingDoc.exists) {
    const bookingData: BookingData = bookingDoc.data()!;
    return res.status(200).json({ id: docId, ...bookingData });
  }

  return res.status(200).json({ });
});

// ------------------
// GET ALL BOOKINGS
// ------------------
bookingRoute.get("/bookings", async (req, res) => {
  const resBookings: Array<Booking>  = [];

  const bookingDocs =
    await bookingsCol.orderBy("timeslot").orderBy("assistant").get();

  bookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resBookings.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resBookings);
});

// ------------------------------
// GET ALL BOOKINGS FOR TIMESLOT
// ------------------------------
bookingRoute.get("/bookings/timeslot/:timeslotid", async (req, res) => {
  const timeslotId: string = req.params.timeslotid;
  const resBookings: Array<Booking>  = [];

  const bookingDocs =
    await bookingsCol.where("timeslot", "==", timeslotId).orderBy("timeslot").orderBy("assistant").get();

  bookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resBookings.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resBookings);
});

// -------------
// POST BOOKING
// -------------
bookingRoute.post("/booking", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  if (!req.body.timeslot ||
      !req.body.assistant)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { timeslot: ..., assistant: ..., ... }");
  }

  const assistantType = await getAssistantType(req.body.assistant);

  let docId: string = ""; // Set from res.id
  const bookingData: BookingData = {
    timeslot:       req.body.timeslot,
    assistant:      req.body.assistant,
    assistantType:  assistantType,
    bookedBy:       userid,
    bookedDatetime: (new Date()).toLocaleString("sv-SE"),
    comment:        req.body.comment,
    status:         req.body.status, // Set initial status, but set to REQUESTED below if not
  };

  // Timeslot validation
  const timeslot = await timeslotsCol.doc(bookingData.timeslot).get();
  if (!timeslot.exists) {
    return res.status(406).json("Timeslot not found");
  }
  const timeslotData = timeslot.data();
  if (!timeslotData) {
    functions.logger.error("Timeslot data undefined", timeslot);
    return res.status(500).json("Timeslot data not defined");
  }
  // TODO - Availability of Timeslot? Or handle in frontend + Status on booking?

  // Timeslot - Period validation
  const period = await periodsCol.doc(timeslotData.period).get();
  if (!period.exists) {
    return res.status(500).json("Period not found for Timeslot");
  }
  const periodData = period.data();
  if (!periodData) {
    functions.logger.error("Period data undefined", period);
    return res.status(500).json("Period data not defined");
  }
  if (periodData.status != PeriodStatus.OPEN) {
    return res.status(406).json("Period is not open");
  }

  // Authorization validation
  const isAdmin = await isUseridAdmin(userid);
  if (isAdmin || await isUserForAssistant(userid, bookingData.assistant)) {
    if (!isAdmin || !req.body.status) {
      // Bookings by Users or status is empty
      bookingData.status = BookingStatus.REQUESTED;
    }

    functions.logger.log("Booking by " + userid + " for " + bookingData.assistant +
        "(" + bookingData.status + ")", 
      bookingData);
    const docRes = await bookingsCol.add(bookingData);
    docId = docRes.id;
  } else {
    return res.status(403).json("Not allowed (not user for assistant, and not admin)");
  }

  return res.status(200).json({
    id: docId,
    ...bookingData,
  });
});

// -------------------------
// PUT BOOKING - ONLY ADMIN
// -------------------------
bookingRoute.put("/booking/:bookingid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const docId: string = req.params.bookingid;

  // Fetch existing booking
  const bookingDoc = await bookingsCol.doc(docId).get();
  if (!bookingDoc.exists) {
    return res.status(400).send("Booking does not exists - " + docId);
  }
  const bookingData: BookingData = bookingDoc.data()!;

  // Authorization validation
  const isAdmin = await isUseridAdmin(userid);
  if (isAdmin || await isUserForAssistant(userid, bookingData.assistant)) {
    // ALLOWED - Admin or isUserForAssistant
    if (req.body.comment) { bookingData.comment = req.body.comment; }

    // ALLOWED - Admin or isUserForAssistant (only REMOVED)
    if (req.body.status && (isAdmin || req.body.status == BookingStatus.REMOVED)) {
      bookingData.status = req.body.status;
      // ALLOWED - Admin or isUserForAssistant (above)
      if (req.body.statusMessage) { bookingData.statusMessage = req.body.statusMessage; }
    }
  } else {
    return res.status(403).json("Not allowed (not user for assistant, and not admin)");
  }

  // Timeslot validation (to check Period below)
  const timeslot = await timeslotsCol.doc(bookingData.timeslot).get();
  if (!timeslot.exists) {
    functions.logger.error("Timeslot not found", bookingData.timeslot);
    return res.status(500).json("Timeslot not found");
  }
  const timeslotData = timeslot.data();
  if (!timeslotData) {
    functions.logger.error("Timeslot data undefined", timeslot);
    return res.status(500).json("Timeslot data not defined");
  }

  // Period validation
  const period = await periodsCol.doc(timeslotData.period).get();
  if (!period.exists) {
    functions.logger.error("Period not found for Timeslot", timeslotData.period);
    return res.status(500).json("Period not found for Timeslot");
  }
  const periodData = period.data();
  if (!periodData) {
    functions.logger.error("Period data undefined", period);
    return res.status(500).json("Period data not defined");
  }
  if (periodData.status != PeriodStatus.OPEN) {
    return res.status(406).json("Period is not open");
  }

  // Update Booking
  await bookingsCol.doc(docId).set(bookingData);

  return res.status(200).json({
    id: docId,
    ...bookingData,
  });
});


export {bookingRoute};
