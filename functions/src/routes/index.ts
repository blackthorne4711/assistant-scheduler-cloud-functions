import * as express from 'express';
import {assistantRoute} from './AssistantRoute';
import {profileRoute} from './ProfileRoute';

export const routes = express.Router();

routes.use(assistantRoute);
routes.use(profileRoute);
