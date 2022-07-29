import {Router} from "express";
import * as functions from "firebase-functions";
import {getUserid, isUseridAdmin, isUserForAssistant} from "../utils/useAuth"
import {bookingsCol, timeslotsCol, periodsCol} from '../utils/useDb'
import {Booking, BookingData, BookingStatus} from "../types/Booking"
import {PeriodStatus} from "../types/Period"
//import {TimeslotData} from "../types/Timeslot"

const bookingRoute = Router();

bookingRoute.get("/booking/:bookingid", async (req, res) => {
  // TODO - error handling in getUserid
  //const userid = getUserid(req);

  const docId: string = req.params.bookingid
  let bookingData: BookingData = {
    "timeslot": '',
    "assistant": '',
    "bookedBy": '',
    "bookedDatetime": -1,
    "comment": '',
    "status": ''
  };
  // let docTimeslot: string = '';
  // let docAssistant: string = '';
  // let docBookedBy: string = '';
  // let docBookedDatetime: number = -1; // TODO - Better init handling 
  // let docComment: string = '';
  // let docStatus: string = '';

  const docRes: FirebaseFirestore.DocumentData =
    await bookingsCol.doc(docId).get();
  if (docRes.exists) {
    bookingData = docRes.data();
    // docTimeslot = docRes.data().timeslot;
    // docAssistant = docRes.data().assistant;
    // docBookedBy = docRes.data().bookedBy;
    // docBookedDatetime = docRes.data().bookedDatetime;
    // docComment = docRes.data().comment;
    // docStatus = docRes.data().status;
    return res.status(200).json({ id: docId, ...bookingData });
  }

  // TODO - Maybe add handling if no doc found?

  return res.status(200).json({ });
});

bookingRoute.get("/bookings", async (req, res) => {
  const resbookings: Array<Booking>  = [];

  const docRes =
    await bookingsCol.orderBy("timeslot").orderBy("assistant").get();

  docRes.forEach((doc: FirebaseFirestore.DocumentData) => {
    resbookings.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resbookings);
});

bookingRoute.post("/booking", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  if(!req.body.timeslot ||
     !req.body.assistant)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { timeslot: ..., assistant: ..., ... }");
  }

  let docId: string = '' // Set from res.id
  let bookingData: BookingData = {
    timeslot: req.body.timeslot,
    assistant: req.body.assistant,
    bookedBy: userid,
    bookedDatetime: (new Date()).valueOf(), // Current timestamp in unix format (seconds)
    comment: req.body.comment,
    status: req.body.status, // TODO - Set initial status, but allow for admin to set
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
  if(isAdmin || await isUserForAssistant(userid, bookingData.assistant)) {
    if (!isAdmin) {
      // Bookings by Users - always as REQUESTED
      bookingData.status = BookingStatus.REQUESTED;
    }

    functions.logger.log("Booking by " + userid + " for " + bookingData.assistant, 
      bookingData);
    const docRes = await bookingsCol.add(bookingData);
    docId = docRes.id;
  } else {
    return res.status(403).json("Not allowed (not user for assistant, and not admin)");
  }

  return res.status(200).json({
    id: docId,
    ...bookingData
  });
});


export {bookingRoute};
