import {Router}                                                         from "express";
import * as functions                                                   from "firebase-functions";
import {getUserid, isUseridAdmin, isUserForAssistant, getAssistantType} from "../utils/useAuth";
import {bookingsCol, timeslotsCol, periodsCol}                          from "../utils/useDb";
import {Booking, BookingData, BookingStatus}                            from "../types/Booking";
import {PeriodStatus}                                                   from "../types/Period";
import {Timeslot, TimeslotData}                                         from "../types/Timeslot";

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
    let   available        = false;
    const assistantTypeInt = parseInt(booking.assistantType);
    const availableSlotInt = parseInt(timeslot.assistantSlots[assistantTypeInt]);
    let   allocatedSlotInt = 0;

    // Available slot for assistant type > 0 (otherwise no point to check further)
    if (availableSlotInt > 0) {
      if (timeslot.assistantAllocations) {
        // Allocation array exists
        allocatedSlotInt = parseInt(timeslot.assistantAllocations[assistantTypeInt]);
        if (allocatedSlotInt < availableSlotInt) {
          // Available slot
          available = true;
        }
      } else {
        // No previous allocation array
        // Initialize array with "0" to match assistantSlots
        timeslot.assistantAllocations = [];
        for (let i = 0; i < timeslot.assistantSlots.length; i++) {
          timeslot.assistantAllocations[i] = "0";
        }
        // Available slot (since previous check - available slot > 0)
        available = true;
      }
    }

    if (available) {
      // Update timeslot with allocation (and add booking id)
      if (!timeslot.assistantAllocations) { timeslot.assistantAllocations = []; }
      timeslot.assistantAllocations[assistantTypeInt] = (allocatedSlotInt+1).toString();
      if (!timeslot.acceptedBookings)     { timeslot.acceptedBookings     = []; }
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
    booking.statusMessage = "Internal error, timeslot not found (" + booking.timeslot + ")";
    await bookingsCol.doc(booking.id).set(booking as BookingData);
  }
}

async function processBookingRemoval(booking: Booking) {
  const timeslotId  = booking.timeslot;
  const timeslotDoc = await timeslotsCol.doc(timeslotId).get();
  if (timeslotDoc.exists) {
    const timeslot: Timeslot = { id: timeslotId, ...timeslotDoc.data()! };

    // Get allocation
    const assistantTypeInt = parseInt(booking.assistantType);
    let   allocatedSlotInt = 0;

    if (timeslot.assistantAllocations) {
      // Update timeslot with allocation (and remove booking id)
      timeslot.assistantAllocations[assistantTypeInt] = (allocatedSlotInt--).toString();
      { // Remove booking id from timeslot
        if (timeslot.acceptedBookings) {
          const index = timeslot.acceptedBookings.indexOf(booking.id);
          if (index > -1) { // To check that booking id was found in array
            timeslot.acceptedBookings.splice(index, 1); // 2nd parameter means remove one item only
          }
        }
      }
      await timeslotsCol.doc(timeslot.id).set(timeslot as TimeslotData);

      // Update booking with status REMOVED
      booking.status = BookingStatus.REMOVED;
      await bookingsCol.doc(booking.id).set(booking as BookingData);
    } else {
      // No previous allocation array - Just remove booking
      functions.logger.error("Allocation array not found in processBookingRemoval (" + booking.timeslot + ")");
      booking.status = BookingStatus.REMOVED;
      await bookingsCol.doc(booking.id).set(booking as BookingData);
    }
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
    // TODO - Possibly allow Admin to set other status? How to handle processing with regards to slots availability?
    // if (!isAdmin || !req.body.status) {
    //   // Bookings by Users or status is empty - STATUS = REQUESTED
    //   bookingData.status = BookingStatus.REQUESTED;
    // }
    // FOR NOW - only set to REQUESTED and process as normal
    bookingData.status = BookingStatus.REQUESTED;

    functions.logger.log("Booking by " + userid + " for " + bookingData.assistant +
        "(" + bookingData.status + ")", 
      bookingData);
    const docRes = await bookingsCol.add(bookingData);
    docId = docRes.id;

    // PROCESS BOOKING
    processBookingRequest({id: docId, ...bookingData});
    // TODO - get feedback on booking processing
    // FOR NOW - let process be separate async
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
