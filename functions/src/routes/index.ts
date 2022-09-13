import * as express from 'express';
import {assistantRoute} from './AssistantRoute';
import {bookingRoute} from './BookingRoute';
import {periodRoute} from './PeriodRoute';
import {profileRoute} from './ProfileRoute';
import {userRoute} from './UserRoute';
import {alertRoute} from './AlertRoute';
import {timeslotRoute} from './TimeslotRoute';

export const routes = express.Router();

routes.use(assistantRoute);
routes.use(bookingRoute);
routes.use(periodRoute);
routes.use(profileRoute);
routes.use(userRoute);
routes.use(alertRoute);
routes.use(timeslotRoute);

