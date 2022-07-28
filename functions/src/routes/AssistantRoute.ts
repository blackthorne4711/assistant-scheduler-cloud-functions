import {Router} from "express";
import {rolesCol} from '../utils/useDb'
import {getUserid} from "../utils/useAuth"
//import {Assistant} from "../types/Assistant"

const assistantRoute = Router();

async function isUseridAdmin(userid: string) {
  let isAdmin: boolean = false;

  const singleRoleDocRef = rolesCol.doc(userid);
  const singleRoleDoc = await singleRoleDocRef.get();
  const singleRole = singleRoleDoc.data();

  if (singleRole) {
    console.log(singleRole.admin)
    isAdmin = singleRole.admin;
  }

  return isAdmin;
}

assistantRoute.get("/assistant/:assistantid", async (req, res) => {
  // TODO - error handling in getUserid
  const userid = getUserid(req);

  // Check if admin or role-userForAssistant
  isUseridAdmin(userid)

  return res.status(200).json("{}");
});

export {assistantRoute};
