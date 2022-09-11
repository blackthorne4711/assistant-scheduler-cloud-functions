import {Router} from "express";
import * as functions from "firebase-functions";
// Auth
import {getUserid, isUseridAdmin, listAuthUsers} from "../utils/useAuth"
import {AuthUser} from "../types/AuthUser"
import {AuthUserRoleProfile} from "../types/AuthUserRoleProfile"
// DB
import {rolesCol} from '../utils/useDb'
import {Role, RoleData} from "../types/Role"
import {profilesCol} from '../utils/useDb'
import {Profile} from "../types/Profile"

const userRoute = Router();

// ------------------
// GET (current) USER
// ------------------
userRoute.get("/user", async (req, res) => {
	const userid = getUserid(req);

	const roleDoc = await rolesCol.doc(userid).get();
	if (roleDoc.exists) {
	    const roleData: RoleData = roleDoc.data()!;
	    return res.status(200).json({ id: userid, ...roleData });
	}
	return res.status(200).json({ });
});

// ----------
// GET USERS
// ----------
userRoute.get("/users", async (req, res) => {
	const userid = getUserid(req);

	const isAdmin: boolean = await isUseridAdmin(userid);
	if (!isAdmin) {
		functions.logger.error("GET /users - not allowed - " + userid);
	    return res.status(403).json("Not allowed for non-admin");
	}

	//const userList = 
	let resAuthUsers: Array<AuthUser> = [];
	let resRoles: Array<Role> = [];
	let resProfiles: Array<Profile> = [];
	let resAuthUserRoleProfiles: Array<AuthUserRoleProfile> = [];

	resAuthUsers = await listAuthUsers();

	const roleDocs = await rolesCol.get();
	roleDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
	  	resRoles.push({ id: doc.id, ...doc.data() });
	});

	const profileDocs = await profilesCol.get();
	profileDocs.forEach((doc: FirebaseFirestore.DocumentData) => {
	  	resProfiles.push({ id: doc.id, ...doc.data() });
	});

	for(let i=0; i < resAuthUsers.length; i++) {
		const matchingRole = resRoles.find((x) => x.id === resAuthUsers[i].id);
		const matchingProfile = resProfiles.find((x) => x.id === resAuthUsers[i].id);

		if (matchingRole && matchingProfile) {
			resAuthUserRoleProfiles.push({
		  		...resAuthUsers[i], 
		  		"admin": matchingRole.admin,
		  		"userForAssistants": matchingRole.userForAssistants,
		  		"firstName": matchingProfile.firstName,
  				"lastName": matchingProfile.lastName
	  		});
		} else if (matchingRole) {
			resAuthUserRoleProfiles.push({
		  		...resAuthUsers[i], 
		  		"admin": matchingRole.admin,
		  		"userForAssistants": matchingRole.userForAssistants,
		  		"firstName": '',
  				"lastName": ''
	  		});
		}
	}

	//Object.assign(resAuthUserRoles, resAuthUsers, resRoles)
	// console.log(resAuthUsers)
	// console.log(resRoles)
	// console.log(resAuthUserRoleProfiles)
	  
	return res.status(200).json(resAuthUserRoleProfiles);
});

// --------
// PUT USER
// --------
userRoute.put("/user/:userid", async (req, res) => {
	const currentuserid = getUserid(req);
	const userid = req.params.userid;

	// CHECK IF ADMIN
	const isAdmin: boolean = await isUseridAdmin(currentuserid);
	if (!isAdmin) {
		functions.logger.error("PUT /user - not allowed - " + currentuserid);
	    return res.status(403).json("Not allowed for non-admin");
	}

	functions.logger.log("PUT /user - " + req.body.admin + " - " + req.body.userForAssistants);

	// CHECK INPUT
	if(!("admin" in req.body) ||
	   !("userForAssistants" in req.body))
	{
	    return res.status(400).send("Incorrect body.\n Correct syntax is: { admin: ..., userForAssistants [ ... ] }");
	}

	const docId: string = req.params.userid
	let roleData: RoleData = {
	    admin: req.body.admin,
	    userForAssistants: req.body.userForAssistants
	};

	  functions.logger.log("PUT /user by " + userid, roleData);
	  await rolesCol.doc(userid).set(roleData);

	  return res.status(200).json({
	    id: docId,
	    ...roleData
	  });
});

export {userRoute};