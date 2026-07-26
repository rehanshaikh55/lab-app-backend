import { runSubscriptionsJob } from './jobs/subscriptionsJob.js';
import { runSlotHoldSweep } from './jobs/slotHoldSweepJob.js';
import { runRetestReminders } from './jobs/retestReminderJob.js';
import { runAccountDeletion } from './jobs/accountDeletionJob.js';
import { runLabResponseSlaSweep } from './jobs/labResponseSlaJob.js';

const HOUR     = 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;
const TEN_MIN  = 10 * 60 * 1000;
const DAY      = 24 * HOUR;

// Swap to BullMQ + Redis when you outgrow a single instance; the atomic
// claim in runDueSubscriptions already makes a second instance safe.
export const initScheduler = (app) => {
  setInterval(
    () => runSubscriptionsJob({ now: new Date(), log: app.log })
      .catch((e) => app.log.error({ err: e }, 'subscriptionsJob failed')),
    HOUR,
  );
  setInterval(
    () => runSlotHoldSweep({ now: new Date(), log: app.log })
      .catch((e) => app.log.error({ err: e }, 'slotHoldSweep failed')),
    FIVE_MIN,
  );
  setInterval(
    () => runRetestReminders({ now: new Date(), log: app.log })
      .catch((e) => app.log.error({ err: e }, 'retestReminders failed')),
    HOUR,
  );
  setInterval(
    () => runAccountDeletion({ now: new Date(), log: app.log })
      .catch((e) => app.log.error({ err: e }, 'accountDeletion failed')),
    DAY,
  );
  setInterval(
    () => runLabResponseSlaSweep({ now: new Date(), log: app.log })
      .catch((e) => app.log.error({ err: e }, 'labResponseSlaSweep failed')),
    TEN_MIN,
  );
  app.log.info('Scheduler initialised (subscriptions hourly, hold-sweep every 5 min, retest reminders hourly, account deletion daily, lab-response SLA sweep every 10 min)');
};
