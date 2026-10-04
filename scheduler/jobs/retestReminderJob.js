import Report from '../../models/report.js';
import { notify } from '../../services/notificationService.js';

export const runRetestReminders = async ({ now = new Date(), log } = {}) => {
  const due = await Report.find({
    remindRetestAt: { $lte: now, $ne: null },
  })
    .populate('booking')
    .limit(100);

  let sent = 0;
  for (const r of due) {
    if (!r.booking) continue;
    try {
      await notify({
        userId: r.booking.user,
        event: 'RETEST_DUE',
        title: 'Time for your re-test',
        body: `It's time to repeat: ${r.parameters?.[0]?.name || 'your test'}.`,
        data: { reportId: r._id.toString() },
      });
      r.remindRetestAt = null;
      await r.save();
      sent += 1;
    } catch (err) {
      log?.error({ err, reportId: r._id }, 'Retest reminder failed');
    }
  }
  return sent;
};
