import {Router} from "express";
import * as functions from "firebase-functions";
import {getUserid, isUseridAdmin} from "../utils/useAuth"
import {alertsCol} from '../utils/useDb'
import {Alert, AlertData} from "../types/Alert"

const alertRoute = Router();

// ---------------
// GET ALL ALERTS
// ---------------
alertRoute.get("/alerts", async (req, res) => {
  const resAlerts: Array<Alert>  = [];

  const alertDocs =
    await alertsCol.orderBy("alertDate").get();

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

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if(!req.body.alertDate ||
     !req.body.alertType ||
     !req.body.alertTitle ||
     !req.body.alertText)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { alertDate: ..., alertType: ..., alertTitle: ..., alertText: ...}");
  }

  let docId: string = '' // Set from res.id
  let alertData: AlertData = {
    alertDate: req.body.alertDate,
    alertType: req.body.alertType,
    alertTitle: req.body.alertTitle,
    alertText: req.body.alertText
  };

  functions.logger.log("POST /alert by " + userid, alertData);
  const docRes = await alertsCol.add(alertData);
  docId = docRes.id;

  return res.status(200).json({
    id: docId,
    ...alertData
  });
});

// ----------
// PUT ALERT
// ----------
alertRoute.put("/alert/:alertid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  const isAdmin: boolean = await isUseridAdmin(userid);
  if (!isAdmin) {
    return res.status(403).json("Not allowed for non-admin");
  }

  if(!req.body.alertDate ||
     !req.body.alertType ||
     !req.body.alertTitle ||
     !req.body.alertText)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { alertDate: ..., alertType: ..., alertTitle: ..., alertText: ...}");
  }

  const docId: string = req.params.alertid
  let alertData: AlertData = {
    alertDate: req.body.alertDate,
    alertType: req.body.alertType,
    alertTitle: req.body.alertTitle,
    alertText: req.body.alertText
  };

  functions.logger.log("PUT /alert by " + userid, alertData);
  await alertsCol.doc(docId).set(alertData);

  return res.status(200).json({
    id: docId,
    ...alertData
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
