import * as functions from "firebase-functions";
// import * as admin from "firebase-admin";
import * as express   from "express";
import {routes}       from "./routes";
import {authenticate} from "./utils/useAuth";
import * as cors      from "cors";

// Express CORS
const app = express();
app.use(cors());

// Express authentication middleware
app.use(authenticate);

// Add all routes
app.use("/", routes);

// Set region
const regionalFunctions = functions.region("europe-west3");

// Expose API as a function
exports.api = regionalFunctions.https.onRequest(app);


