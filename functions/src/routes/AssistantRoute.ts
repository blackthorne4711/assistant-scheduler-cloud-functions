import {Router} from "express";
import {getUserid, isUseridAdmin} from "../utils/useAuth"
import {assistantsCol} from '../utils/useDb'
import {Assistant} from "../types/Assistant"

const assistantRoute = Router();

assistantRoute.get("/assistant/:assistantid", async (req, res) => {
  // TODO - error handling in getUserid
  //const userid = getUserid(req);

  const docId: string = req.params.assistantid
  let docFirstName: string = '';
  let docLastName: string = '';
  let docType: string = '';

  const docRes: FirebaseFirestore.DocumentData =
    await assistantsCol.doc(docId).get();
  if (docRes.exists) {
    docFirstName = docRes.data().firstname;
    docLastName = docRes.data().lastname;
    docType = docRes.data().type;
  }

  // TODO - Maybe add handling if no doc found?

  return res.status(200).json({
    id: docId,
    firstname: docFirstName,
    lastname: docLastName,
    type: docType
  });
});

assistantRoute.get("/assistants", async (req, res) => {
  const resAssistants: Array<Assistant>  = [];

  const docRes: FirebaseFirestore.DocumentData =
    await assistantsCol.orderBy("lastname").orderBy("firstname").get();

  docRes.forEach((doc: FirebaseFirestore.DocumentData) => {
    resAssistants.push({ id: doc.id, ...doc.data() });
  });
  
  return res.status(200).json(resAssistants);
});

assistantRoute.post("/assistant", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  if(!req.body.firstname ||
     !req.body.lastname ||
     !req.body.type)
  {
    return res.status(400).send("Incorrect body.\n Correct syntax is: { firstname: ..., lastname: ..., type: ... }");
  }

  let docId: string = '' // Set from res.id
  const docFirstName: string = req.body.firstname;
  const docLastName: string = req.body.lastname;
  const docType: string = req.body.type;

  // TODO - Check that type is valid

  if(await isUseridAdmin(userid)) {
    const docRes = await assistantsCol.add({
      firstname: docFirstName,
      lastname: docLastName,
      type: docType
    });
    docId = docRes.id;
  } else {
    return res.status(403).json("Not allowed for non-admin");
  }

  return res.status(200).json({
    id: docId,
    firstname: docFirstName,
    lastname: docLastName,
    type: docType
  });
});


export {assistantRoute};
