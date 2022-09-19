import * as functions from "firebase-functions";
// import * as admin from "firebase-admin";
import * as express   from "express";
import {routes}       from "./routes";
import {authenticate} from "./utils/useAuth";
import * as cors      from "cors";

// const cors = require("cors");

// admin.initializeApp();
// const db = admin.firestore();

const app = express();

// TODO - body-parser
// app.use(bodyParser.json({ limit: "50mb", type: "application/json" }));
// app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
// dotenv.config();

// Express CORS
app.use(cors());

// Express authentication middleware
app.use(authenticate);

// Add all routes
app.use("/", routes);

// Expose API as a function
exports.api = functions.https.onRequest(app);
