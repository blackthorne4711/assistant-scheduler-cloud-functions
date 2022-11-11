import {Router}                                               from "express";
import * as functions                                         from "firebase-functions";
import {getUserid,
        isUseridAdmin,
        isUseridTrainer,
        isUserForAssistant}                                   from "../utils/useAuth";
import {bookingsCol, timeslotsCol, periodsCol, assistantsCol} from "../utils/useDb";
import {Booking, BookingData, BookingStatus}                  from "../types/Booking";
import {PeriodStatus}                                         from "../types/Period";
import {Timeslot, TimeslotData}                               from "../types/Timeslot";
import {getAssistantsForUser}                                 from "../routes/UserRoute";

// Import helper functions
import { getWeekday } from "../utils/helperfunctions";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const bookingRoute = Router();

// ------------------
// BOOKING PROCESSING
// ------------------
async function processBookingRequest(booking: Booking) {
  const timeslotId  = booking.timeslot;
  const timeslotDoc = await timeslotsCol.doc(timeslotId).get();
  if (timeslotDoc.exists) {
    const timeslot: Timeslot = { id: timeslotId, ...timeslotDoc.data()! };

    // Check availability
    const assistantTypeInt = parseInt(booking.assistantType);
    const availableSlotInt = parseInt(timeslot.assistantSlots[assistantTypeInt]);
    const allocatedSlotInt = parseInt(timeslot.assistantAllocations[assistantTypeInt]);

    if (availableSlotInt > 0 && allocatedSlotInt < availableSlotInt) {
      // Update timeslot with allocation (and add booking id)
      timeslot.assistantAllocations[assistantTypeInt] = (allocatedSlotInt+1).toString();
      timeslot.acceptedBookings.push(booking.id);
      await timeslotsCol.doc(timeslot.id).set(timeslot as TimeslotData);

      // Update booking with status ACCEPTED
      booking.status = BookingStatus.ACCEPTED;
      await bookingsCol.doc(booking.id).set(booking as BookingData);
    } else {
      // Reject booking with message
      booking.status = BookingStatus.REJECTED;
      booking.statusMessage = "No available assistant slots (" + booking.assistantType + ")";
      await bookingsCol.doc(booking.id).set(booking as BookingData);
    }
  } else {
    // Reject booking with (internal) error message
    functions.logger.error("Timeslot not found in processBookingRequest (" + booking.timeslot + ")");
    booking.status = BookingStatus.REJECTED;
    await bookingsCol.doc(booking.id).set(booking as BookingData);
  }
  return booking.status;
}
 
export async function processBookingRemoval(booking: Booking) {
  const timeslotId  = booking.timeslot;
  const timeslotDoc = await timeslotsCol.doc(timeslotId).get();
  if (timeslotDoc.exists) {
    const timeslot: Timeslot = { id: timeslotId, ...timeslotDoc.data()! };

    // Get allocation
    const assistantTypeInt = parseInt(booking.assistantType);
    const allocatedSlotInt = parseInt(timeslot.assistantAllocations[assistantTypeInt]);

    // Update timeslot with allocation (and remove booking id)
    timeslot.assistantAllocations[assistantTypeInt] = (allocatedSlotInt-1).toString();
    { // Remove booking id from timeslot
      const index = timeslot.acceptedBookings.indexOf(booking.id);
      if (index > -1) { // To check that booking id was found in array
        timeslot.acceptedBookings.splice(index, 1); // 2nd parameter means remove one item only
      }
    }
    await timeslotsCol.doc(timeslot.id).set(timeslot as TimeslotData);

    // Update booking with status REMOVED
    booking.status = BookingStatus.REMOVED;
    await bookingsCol.doc(booking.id).set(booking as BookingData);
  } else {
    // Timeslot not found - Just remove booking
    functions.logger.error("Timeslot not found in processBookingRemoval (" + booking.timeslot + ")");
    booking.status = BookingStatus.REMOVED;
    await bookingsCol.doc(booking.id).set(booking as BookingData);
  }
}

// -------------
// GET BOOKING
// -------------
bookingRoute.get("/booking/:bookingid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const docId: string = req.params.bookingid;
  const bookingDoc = await bookingsCol.doc(docId).get();
  if (bookingDoc.exists) {
    const bookingData: BookingData = bookingDoc.data()!;
    return res.status(200).json({ id: docId, ...bookingData });
  }

  return res.status(200).json({ });
});

// res.set('Access-Control-Allow-Origin', '*');

// ------------------
// GET ALL BOOKINGS
// ------------------
bookingRoute.get("/bookings", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const resBookings: Array<Booking>  = [];

  const bookingDocs =
    await bookingsCol.orderBy("timeslot").orderBy("assistant").get();

  bookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resBookings.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resBookings);
});

// ---------------------------------------------------------------------
// GET ALL UPCOMING BOOKINGS (current and future bookings)
// ---------------------------------------------------------------------
bookingRoute.get("/bookings/upcoming", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const userid = getUserid(req);

  // CHECK IF ADMIN
  const isAdmin: boolean = await isUseridAdmin(userid);
  const isTrainer: boolean = await isUseridTrainer(userid);

  if (!isAdmin && !isTrainer) {
    functions.logger.error("GET /bookings/upcoming - not allowed - " + userid);
    return res.status(403).json("Not allowed for non-(admin/trainer)");
  }

  const resBookings: Array<Booking>  = [];
  const bookingDocs = await bookingsCol.where("timeslotDate", ">=", (new Date()).toLocaleDateString("sv-SE")).get();
  bookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resBookings.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resBookings);
});

// ---------------------------------------------------------------------
// GET ALL USER BOOKINGS (i.e. for assistants for user and current dates)
// ---------------------------------------------------------------------
bookingRoute.get("/bookings/user", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const userid     = getUserid(req);
  const assistants = await getAssistantsForUser(userid);

  const resBookings: Array<Booking>  = [];

  // Loop through users assistants
  for (let i = 0; i < assistants.length; i++) {
    functions.logger.log("GET /bookings/user - assistant - " + assistants[i]);
    const bookingDocs =
      await bookingsCol.where("timeslotDate", ">=", (new Date()).toLocaleDateString("sv-SE")).where("assistant", "==", assistants[i]).get();

    bookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
      functions.logger.log("GET /bookings/user - booking - " + assistants[i]);
      resBookings.push({ id: doc.id, ...doc.data() });
    });
  }
  
  return res.status(200).json(resBookings);
});

// -----------------------------
// GET ALL BOOKINGS FOR PERIOD
// -----------------------------
bookingRoute.get("/bookings/period/:periodid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const periodId:     string           = req.params.periodid;
  const resBookings: Array<Booking>  = [];
  const bookingDocs =
    await bookingsCol.where("timeslotPeriod", "==", periodId).get();

  bookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resBookings.push({ id: doc.id, ...doc.data() });
  });

  return res.status(200).json(resBookings);
});

// ------------------------------
// GET ALL BOOKINGS FOR TIMESLOT
// ------------------------------
bookingRoute.get("/bookings/timeslot/:timeslotid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const timeslotId: string = req.params.timeslotid;
  const resBookings: Array<Booking>  = [];

  const bookingDocs =
    await bookingsCol.where("timeslot", "==", timeslotId).orderBy("timeslot").orderBy("assistant").get();

  bookingDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resBookings.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resBookings);
});

// -------------------------------------
// GET ALL OPEN (AND CURRENT) BOOKINGS 
// -------------------------------------
bookingRoute.get("/bookings/open", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const periodDocs = await periodsCol.where("status", "==", "OPEN").orderBy("from").get();
  const resBookings:   Array<Booking> = [];

  for await (const period of periodDocs.docs) {
    functions.logger.log("GET /bookings/open - " + period.id + " (" + (new Date()).toLocaleDateString("sv-SE") + ")");

    const bookingDocs = await bookingsCol
      .where("timeslotPeriod", "==", period.id)
      .where("timeslotDate",   ">=", (new Date()).toLocaleDateString("sv-SE")).get();

    for await (const booking of bookingDocs.docs) {
      resBookings.push({ id: booking.id, ...booking.data() });
    }
  }

  return res.status(200).json(resBookings);
});


// -------------
// POST BOOKING
// -------------
bookingRoute.post("/booking", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  if (!req.body.timeslot ||
      !req.body.assistant)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { timeslot: ..., assistant: ..., ... }");
  }

  let docId: string = ""; // Set from res.id
  const bookingData: BookingData = {
    timeslot:          req.body.timeslot,
    timeslotDate:      "", // TO BE UPDATED
    timeslotWeekday:   "", // TO BE UPDATED
    timeslotTime:      "", // TO BE UPDATED
    timeslotColor:     "", // TO BE UPDATED
    timeslotPeriod:    "", // TO BE UPDATED
    assistant:         req.body.assistant,
    assistantType:     "", // TO BE UPDATED
    assistantFullname: "", // TO BE UPDATED
    bookedBy:          userid,
    bookedDatetime:    (new Date()).toLocaleString("sv-SE"),
    comment:           req.body.comment,
    status:            BookingStatus.REQUESTED, // TODO - Possibly allow Admin to set other status? 
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

  // Assistant validation
  const assistant = await assistantsCol.doc(bookingData.assistant).get();
  if (!assistant.exists) {
    return res.status(500).json("Assistant not found");
  }
  const assistantData = assistant.data();

  // Set (additional) booking data
  bookingData.timeslotDate      = timeslotData.date;
  bookingData.timeslotWeekday   = getWeekday(timeslotData.date);
  bookingData.timeslotTime      = timeslotData.startTime + " - " + timeslotData.endTime;
  bookingData.timeslotColor     = timeslotData.color ? timeslotData.color : "";
  bookingData.timeslotPeriod    = timeslotData.period;
  bookingData.assistantType     = assistantData ? assistantData.type : "";
  bookingData.assistantFullname = assistantData ? assistantData.fullname : "";
  
  // Authorization validation
  const isAdmin = await isUseridAdmin(userid);
  if (isAdmin || await isUserForAssistant(userid, bookingData.assistant)) {
    functions.logger.log("Booking by " + userid + " for " + bookingData.assistant + "(" + bookingData.status + ")", bookingData);
    const docRes = await bookingsCol.add(bookingData);
    docId = docRes.id;

    // PROCESS BOOKING
    await processBookingRequest({id: docId, ...bookingData});
    // TODO - get feedback on booking processing
  } else {
    return res.status(403).json("Not allowed (not user for assistant, and not admin)");
  }

  return res.status(200).json({
    id: docId,
    ...bookingData,
  });
});

// --------------------------------------------------
// PUT BOOKING
// - (isUserForAssistant) - ONLY ALLOW STATUS REMOVED
// - (ONLY ADMIN)         - ALLOW STATUS TO BE SET
// --------------------------------------------------
bookingRoute.put("/booking/:bookingid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
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

  bookingData.updatedBy       = userid;
  bookingData.updatedDatetime = (new Date()).toLocaleString("sv-SE");

  // UPDATE BOOKING
  await bookingsCol.doc(docId).set(bookingData);
  // PROCESS BOOKING
  if (bookingData.status == BookingStatus.REMOVED || (isAdmin && bookingData.status == BookingStatus.REJECTED)) {
    processBookingRemoval({ id: docId, ...bookingData});
  }
  // TODO - Handle Admin setting other status than REMOVED/REJECTED

  return res.status(200).json({
    id: docId,
    ...bookingData,
  });
});

export {bookingRoute};
