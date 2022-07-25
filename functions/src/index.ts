import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express'

// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
//   // TODO: ADD YOUR DATABASE URL
//   databaseURL: undefined
// });

admin.initializeApp();

const app = express();

// Express authentication middleware
const authenticate = async (req: any, res: any, next: any) => {
	functions.logger.log(`GET /api/profile init`);

  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
  	functions.logger.log(`ERROR GET /api/profile - !req.headers.authorization`);
    res.status(403).send('Unauthorized');
    return;
  }
  const idToken = req.headers.authorization.split('Bearer ')[1];
  try {
  	functions.logger.log(`GET /api/profile - verifyIdToken`);
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch(e) {
    res.status(403).send('Unauthorized');
    return;
  }
};
app.use(authenticate);

// GET /api/profile
// Get profile for current user
app.get('/api/profile', async (req, res) => {

	functions.logger.log(`GET /api/profile for current user`);

	try {
		// @ts-ignore
		const uid = req.user.uid;
		

		
		return res.status(200).json({ uid });
	} catch(error) {
		functions.logger.log(
		  'ERROR - GET /api/profile',
		  // @ts-ignore
		  error.message
		);
		return res.sendStatus(500);
	}
});

// Expose API as a function
exports.api = functions.https.onRequest(app);

