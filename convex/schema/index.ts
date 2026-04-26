import { defineSchema } from 'convex/server';
import { organizations } from './organizations';
import { users } from './users';
import { leaves } from './leaves';
import { notifications } from './notifications';
import { tickets } from './tickets';
import { automation } from './automation';
import { security } from './security';
import { sla } from './sla';
import { employees } from './employees';
import { drivers } from './drivers';
import { tasks } from './tasks';
import { events } from './events';
import { chat } from './chat';
import { productivity } from './productivity';
import { messenger } from './messenger';
import { calendar } from './calendar';
import { analytics } from './analytics';
import { settings } from './settings';
import { corporate } from './corporate';
import { conflicts } from './conflicts';
import { ai } from './ai';
import { payroll } from './payroll';

export default defineSchema({
  ...organizations,
  ...users,
  ...leaves,
  ...notifications,
  ...tickets,
  ...automation,
  ...security,
  ...sla,
  ...employees,
  ...drivers,
  ...tasks,
  ...events,
  ...chat,
  ...productivity,
  ...messenger,
  ...calendar,
  ...analytics,
  ...settings,
  ...corporate,
  ...conflicts,
  ...ai,
  ...payroll,
});

export {
  organizations,
  users,
  leaves,
  notifications,
  tickets,
  automation,
  security,
  sla,
  employees,
  drivers,
  tasks,
  events,
  chat,
  productivity,
  messenger,
  calendar,
  analytics,
  settings,
  corporate,
  conflicts,
  ai,
  payroll,
};
