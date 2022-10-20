import {Router}            from "express";
import * as functions      from "firebase-functions";
import {getUserid,
        isUseridAdmin,
        isUseridTrainer}   from "../utils/useAuth";
import {alertsCol}         from "../utils/useDb";
import {Alert, AlertData}  from "../types/Alert";

/* eslint new-cap: ["error", { "capIsNewExceptions": ["Router"] }] */
const alertRoute = Router();

// ---------------
// GET ALL ALERTS
// ---------------
alertRoute.get("/alerts", async (req, res) => {
  const resAlerts: Array<Alert>  = [];

  const alertDocs =
    await alertsCol.orderBy("date", "desc").get();

  alertDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
    resAlerts.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resAlerts);
});

// -----------
// POST ALERT
// -----------
alertRoute.post("/alert", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin:   boolean = await isUseridAdmin(userid);
  const isTrainer: boolean = await isUseridTrainer(userid);
  if (!isAdmin && !isTrainer) {
    return res.status(403).json("Not allowed for non-(admin/trainer)");
  }

  if (!req.body.date  ||
      !req.body.type  ||
      !req.body.title) {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { date: ..., type: ..., title: ..., ...}");
  }

  let docId: string = ""; // Set from res.id
  const alertData: AlertData = {
    date:  req.body.date,
    type:  req.body.type,
    title: req.body.title,
    text:  req.body.text,
  };

  functions.logger.log("POST /alert by " + userid, alertData);
  const docRes = await alertsCol.add(alertData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...alertData,
  });
});

// ----------
// PUT ALERT
// ----------
alertRoute.put("/alert/:alertid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);
  
  const isAdmin:   boolean = await isUseridAdmin(userid);
  const isTrainer: boolean = await isUseridTrainer(userid);
  if (!isAdmin && !isTrainer) {
    return res.status(403).json("Not allowed for non-(admin/trainer)");
  }

  if (!req.body.date  ||
      !req.body.type  ||
      !req.body.title)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { date: ..., type: ..., title: ..., ...}");
  }

  const docId: string = req.params.alertid;
  const alertData: AlertData = {
    date:  req.body.alertDate,
    type:  req.body.alertType,
    title: req.body.alertTitle,
    text:  req.body.alertText,
  };

  functions.logger.log("PUT /alert by " + userid, alertData);
  await alertsCol.doc(docId).set(alertData);

  return res.status(200).json({
    id: docId,
    ...alertData,
  });
});

// -------------
// DELETE ALERT
// -------------
alertRoute.delete("/alert/:alertid", async (req, res) => {
  const docId: string = req.params.alertid;
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  await alertsCol.doc(docId).delete();

  return res.status(200).json({ });
});

export {alertRoute};
