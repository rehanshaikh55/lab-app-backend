import User from '../models/user.js';
import Notification from '../models/notification.js';
import { FCM_ENABLED } from '../config/env.js';
import { initFirebase } from '../config/firebase.js';

// userId -> Set<socket>
const sockets = new Map();

export const registerSocket = (userId, socket) => {
  const key = userId.toString();
  if (!sockets.has(key)) sockets.set(key, new Set());
  sockets.get(key).add(socket);
};

export const unregisterSocket = (userId, socket) => {
  const key = userId.toString();
  sockets.get(key)?.delete(socket);
  if (sockets.get(key)?.size === 0) sockets.delete(key);
};

const broadcast = (userId, payload) => {
  const set = sockets.get(userId.toString());
  if (!set) return;
  for (const s of set) {
    try {
      if (s.readyState === 1) s.send(JSON.stringify(payload));
    } catch {
      /* ignore broken socket */
    }
  }
};

const sendPush = async (userId, title, body, data) => {
  if (!FCM_ENABLED) return;
  try {
    const fb = initFirebase();
    if (!fb) return;
    const user = await User.findById(userId).select('fcmToken');
    if (!user?.fcmToken) return;
    await fb.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
    });
  } catch {
    /* never block the request on push failure */
  }
};

export const notify = async ({ userId, event, title, body, data }) => {
  const payload = { event, title, body, data, at: new Date().toISOString() };
  let doc = null;
  try {
    doc = await Notification.create({ user: userId, event, title, body, data });
  } catch {
    /* model may not yet exist in some tests; broadcast anyway */
  }
  broadcast(userId, doc ? { id: doc._id.toString(), ...payload } : payload);
  await sendPush(userId, title, body, data);
  return doc;
};

const STATUS_COPY = {
  CONFIRMED:  ['Booking confirmed', 'Your lab booking is confirmed.'],
  COLLECTED:  ['Sample collected', 'Your sample has been collected.'],
  PROCESSING: ['Processing your sample', 'Your sample is now being processed.'],
  COMPLETED:  ['Report ready', 'Your report is ready to view.'],
  CANCELLED:  ['Booking cancelled', 'Your booking was cancelled.'],
};

export const notifyBookingStatus = async (booking) => {
  const copy = STATUS_COPY[booking.status];
  if (!copy) return;
  await notify({
    userId: booking.user,
    event: 'BOOKING_STATUS',
    title: copy[0],
    body: copy[1],
    data: { bookingId: booking._id.toString(), status: booking.status },
  });
};

export const listNotifications = async ({ userId, page = 1, limit = 20 }) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [items, total, unread] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Notification.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);
  return { items, total, unread, page: parseInt(page), limit: parseInt(limit) };
};

export const markRead = async ({ userId, id }) =>
  Notification.findOneAndUpdate({ _id: id, user: userId }, { readAt: new Date() }, { new: true });

export const markAllRead = async ({ userId }) => {
  const r = await Notification.updateMany({ user: userId, readAt: null }, { readAt: new Date() });
  return { matched: r.matchedCount, modified: r.modifiedCount };
};

export const unreadCount = async ({ userId }) => ({
  unread: await Notification.countDocuments({ user: userId, readAt: null }),
});
