import {Router}                                    from "express";
import * as functions                              from "firebase-functions";
import {getUserid, isUseridAdmin}                  from "../utils/useAuth";
import {assistantsCol, bookingsCol}                from "../utils/useDb";
import {Assistant, AssistantData, EMPTY_ASSISTANT} from "../types/Assistant";

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
  const docId: string = req.params.assistantid;
  const assistantDoc = await assistantsCol.doc(docId).get();
  if (assistantDoc.exists) {
    const assistantData: AssistantData= assistantDoc.data()!;
    return res.status(200).json({ id: docId, ...assistantData });
  }

  return res.status(200).json({ });
});

// ------------------
// GET ALL ASSISTANTS
// ------------------
assistantRoute.get("/assistants", async (req, res) => {
  const resAssistants: Array<Assistant>  = [];
  const assistantDocs =
    await assistantsCol.orderBy("lastname").orderBy("firstname").get();

  assistantDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resAssistants.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resAssistants);
});

// ---------------
// POST ASSISTANT
// ---------------
assistantRoute.post("/assistant", async (req, res) => {
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
    type:      req.body.type,
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

  const docId: string = req.params.assistantid;
  const assistantData: AssistantData = {
    firstname: req.body.firstname,
    lastname:  req.body.lastname,
    fullname:  req.body.firstname + " " + req.body.lastname,
    type:      req.body.type,
  };

  functions.logger.log("POST /assistant by " + userid, assistantData);
  await assistantsCol.doc(docId).set(assistantData);

  // UPDATE BOOKINGS
  // Only update fullname (leave type as denormalized form time of booking)
  const bookingDocs = await bookingsCol.where("assistant", "==", docId).get();

  for await (const booking of bookingDocs.docs) {
    await bookingsCol.doc(booking.id).set({
        assistantFullname: assistantData.fullname,
      }, { merge: true });
  }

  return res.status(200).json({
    id: docId,
    ...assistantData,
  });
});


export {assistantRoute};
