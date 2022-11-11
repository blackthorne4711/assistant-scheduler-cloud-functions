import {Router}                                    from "express";
import * as functions                              from "firebase-functions";
import {getUserid,
        isUseridAdmin,
        isUseridTrainer,
        isUserForAssistant}                        from "../utils/useAuth";
import {assistantsCol, bookingsCol, rolesCol}      from "../utils/useDb";
import {Assistant, AssistantData, EMPTY_ASSISTANT} from "../types/Assistant";
import {BookingStatus}                             from "../types/Booking";
import {RoleData}                                  from "../types/Role";
import {processBookingRemoval}                     from "../routes/BookingRoute";
import {getAssistantsForUser}                      from "../routes/UserRoute";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const assistantRoute = Router();

// -----------------------------------------------
// Helper function to get assistant for assistant id
// -----------------------------------------------
export async function getAssistant(assistantid: string) {
  let assistant: Assistant = EMPTY_ASSISTANT;

  const assistantDoc = await assistantsCol.doc(assistantid).get();
  if (assistantDoc.exists) {
    const assistantData: AssistantData = assistantDoc.data()!;
    assistant = { id: assistantid, ...assistantData };
  }

  return assistant;
}

// -------------
// GET ASSISTANT
// -------------
assistantRoute.get("/assistant/:assistantid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const docId: string = req.params.assistantid;
  const assistantDoc = await assistantsCol.doc(docId).get();
  if (assistantDoc.exists) {
    const assistantData: AssistantData= assistantDoc.data()!;
    return res.status(200).json({ id: docId, ...assistantData });
  }

  return res.status(200).json({ });
});

// -------------------
// GET USER ASSISTANTS
// -------------------
assistantRoute.get("/assistants/user", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const userid = getUserid(req);

  const userForAssistants: Array<string> = await getAssistantsForUser(userid);
  const resAssistants: Array<Assistant>  = [];

  for await (const assistantid of userForAssistants) {
    const assistantDoc = await assistantsCol.doc(assistantid).get();
    if (assistantDoc.exists) {
      const assistantData: AssistantData= assistantDoc.data()!;
      if (!assistantData.disabled) {
        resAssistants.push({ id: assistantid, ...assistantData });
      }   
    }
  }
  
  return res.status(200).json(resAssistants);
});

// ------------------
// GET ALL ASSISTANTS
// ------------------
assistantRoute.get("/assistants", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const userid = getUserid(req);
  const isAdmin:   boolean = await isUseridAdmin(userid);
  const isTrainer: boolean = await isUseridTrainer(userid);

  const resAssistants: Array<Assistant>  = [];
  const assistantDocs =
    await assistantsCol.orderBy("lastname").orderBy("firstname").get();

  assistantDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    // TEST - Remove phone for Assistants if not Admin/Trainer
    const assistantData: AssistantData = doc.data();
    functions.logger.log("GET /assistant by " + userid + " - " + isAdmin + " - " + isTrainer);

    if (!isAdmin && !isTrainer) {
      functions.logger.log("GET /assistant by " + userid + " remove phone");
      assistantData.phone = "";
    }
    resAssistants.push({ id: doc.id, ...assistantData });
  });
  
  return res.status(200).json(resAssistants);
});

// ---------------
// POST ASSISTANT
// ---------------
assistantRoute.post("/assistant", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // TODO - error handling in getUserid
  const userid = getUserid(req);
  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.firstname ||
      !req.body.lastname ||
      !req.body.type) {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { firstname: ..., lastname: ..., type: ... }");
  }

  // TODO - Unique constraint check?

  let docId: string = ""; // Set from res.id
  const assistantData: AssistantData = {
    firstname: req.body.firstname,
    lastname:  req.body.lastname,
    fullname:  req.body.firstname + " " + req.body.lastname,
    phone:     req.body.phone ? req.body.phone : "",
    type:      req.body.type,
    disabled:  false,
  };

  functions.logger.log("POST /assistant by " + userid, assistantData);
  const docRes = await assistantsCol.add(assistantData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...assistantData,
  });
});

// ---------------
// PUT ASSISTANT
// ---------------
assistantRoute.put("/assistant/:assistantid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if (!req.body.firstname ||
      !req.body.lastname  ||
      !req.body.type) {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { firstname: ..., lastname: ..., type: ... }");
  }

  // TODO - Unique constraint check?

  const assistantid: string = req.params.assistantid;
  let assistantData: AssistantData = EMPTY_ASSISTANT;

  const assistantDoc = await assistantsCol.doc(assistantid).get();
  if (assistantDoc.exists) {
    assistantData = assistantDoc.data()!;
  }

  assistantData.firstname = req.body.firstname;
  assistantData.lastname  = req.body.lastname;
  assistantData.fullname  = req.body.firstname + " " + req.body.lastname;
  assistantData.phone     = req.body.phone ? req.body.phone : "";
  assistantData.type      = req.body.type;

  functions.logger.log("PUT /assistant by " + userid, assistantData);
  await assistantsCol.doc(assistantid).set({
      firstname: assistantData.firstname,
      lastname:  assistantData.lastname,
      fullname:  assistantData.fullname,
      phone:     assistantData.phone,
      type:      assistantData.type,
      // disabled is handled in separate endpoint, to encapsulate logic
    }, { merge: true });

  // UPDATE BOOKINGS
  // Only update fullname (leave type as denormalized form time of booking)
  const bookingDocs = await bookingsCol.where("assistant", "==", assistantid).get();

  for await (const booking of bookingDocs.docs) {
    await bookingsCol.doc(booking.id).set({
        assistantFullname: assistantData.fullname,
      }, { merge: true });
  }

  return res.status(200).json({
    id: assistantid,
    ...assistantData,
  });
});

// ------------------
// PUT ASSISTANT INFO (for UserForAssistant)
// ------------------
assistantRoute.put("/assistant/:assistantid/info", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // TODO - error handling in getUserid
  const userid = getUserid(req);
  const assistantid: string = req.params.assistantid;
  const userAssistant: boolean = await isUserForAssistant(userid, assistantid);

  if (!userAssistant) {
    return res.status(403).json("Not user for assistant - " + assistantid);
  }

  if (!req.body.firstname ||
      !req.body.lastname) {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { firstname: ..., lastname: ..., phone: ... }");
  }

  let assistantData: AssistantData = EMPTY_ASSISTANT;

  const assistantDoc = await assistantsCol.doc(assistantid).get();
  if (assistantDoc.exists) {
    assistantData = assistantDoc.data()!;
  }

  assistantData.firstname = req.body.firstname;
  assistantData.lastname  = req.body.lastname;
  assistantData.fullname  = req.body.firstname + " " + req.body.lastname;
  assistantData.phone     = req.body.phone ? req.body.phone : "";
  // NOT TYPE

  functions.logger.log("PUT /assistant/" + assistantid + "/info  by " + userid, assistantData);
  await assistantsCol.doc(assistantid).set({
      firstname: assistantData.firstname,
      lastname:  assistantData.lastname,
      fullname:  assistantData.fullname,
      phone:     assistantData.phone,
    }, { merge: true });

  // UPDATE BOOKINGS
  // Only update fullname (leave type as denormalized form time of booking)
  const bookingDocs = await bookingsCol.where("assistant", "==", assistantid).get();

  for await (const booking of bookingDocs.docs) {
    await bookingsCol.doc(booking.id).set({
        assistantFullname: assistantData.fullname,
      }, { merge: true });
  }

  return res.status(200).json({
    id: assistantid,
    ...assistantData,
  });
});

// -----------------
// DISABLE ASSISTANT
// -----------------
assistantRoute.put("/assistant/:assistantid/disabled", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  const assistantid: string = req.params.assistantid;
  const disabled = !!req.body.disabled;

  functions.logger.log("PUT /assistant/" + assistantid + "/disabled by " + userid, disabled);

  // SET DISABLED
  await assistantsCol.doc(assistantid).set({ disabled: disabled }, { merge: true });

  // REMOVE ALL EXISTING FUTURE BOOKINGS
  const bookingDocs = await bookingsCol.where("timeslotDate", ">=", (new Date()).toLocaleDateString("sv-SE")).where("assistant", "==", assistantid).get();
  for await (const booking of bookingDocs.docs) {
    const bookingId   = booking.id;
    const bookingData = booking.data()!;
    bookingData.status        = BookingStatus.REMOVED;
    bookingData.statusMessage = "Removed because assistant is inactivated";
    await processBookingRemoval({
      id: bookingId,
      ...bookingData,
    });
  }

  return res.status(200).json();
});

// ---------------
// DELETE ASSISTANT
// ---------------
assistantRoute.delete("/assistant/:assistantid", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // TODO - error handling in getUserid
  const userid = getUserid(req);
  const assistantid = req.params.assistantid;

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  // REMOVE ALL EXISTING FUTURE BOOKINGS (to reset timeslot availability)
  const bookingDocs = await bookingsCol.where("timeslotDate", ">=", (new Date()).toLocaleDateString("sv-SE")).where("assistant", "==", assistantid).get();
  for await (const booking of bookingDocs.docs) {
    const bookingId   = booking.id;
    const bookingData = booking.data()!;
    bookingData.status        = BookingStatus.REMOVED;
    bookingData.statusMessage = "Removed because assistant is deleted";
    await processBookingRemoval({
      id: bookingId,
      ...bookingData,
    });
  }
  // DELETE ALL BOOKINGS
  const delbookingDocs = await bookingsCol.where("timeslotDate", ">=", (new Date()).toLocaleDateString("sv-SE")).where("assistant", "==", assistantid).get();
  for await (const booking of delbookingDocs.docs) {
    await bookingsCol.doc(booking.id).delete();
  }
  // DELETE FROM ROLE-USERFORASSISTANTS
  const roleDocs = await rolesCol.get();
  for await (const role of roleDocs.docs) {
    const roleData: RoleData = role.data()!;
    if (roleData.userForAssistants.includes(assistantid)) {
      const newArray = roleData.userForAssistants.filter((id) => id !== assistantid);
      roleData.userForAssistants = newArray;
      await rolesCol.doc(role.id).set(roleData);
    }
  }

  // DELETE ASSISTANT
  functions.logger.log("DELETE /assistant by " + userid, assistantid);
  await assistantsCol.doc(assistantid).delete();
  return res.status(200).json();
});

export {assistantRoute};
