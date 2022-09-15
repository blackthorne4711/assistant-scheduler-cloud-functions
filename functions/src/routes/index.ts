import * as express from 'express';

import {userRoute}      from './UserRoute';
import {profileRoute}   from './ProfileRoute';
import {assistantRoute} from './AssistantRoute';
import {alertRoute}     from './AlertRoute';
import {periodRoute}    from './PeriodRoute';
import {scheduleRoute}  from './ScheduleRoute';
import {timeslotRoute}  from './TimeslotRoute';
import {bookingRoute}   from './BookingRoute';

export const routes = express.Router();

routes.use(userRoute);
routes.use(profileRoute);
routes.use(assistantRoute);
routes.use(alertRoute);
routes.use(periodRoute);
routes.use(scheduleRoute);
routes.use(timeslotRoute);
routes.use(bookingRoute);


