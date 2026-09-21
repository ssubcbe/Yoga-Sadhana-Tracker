// Thin localStorage wrapper. Data lives in this browser only, scoped per
// signed-in user id (their email). That is the deliberate hackathon tradeoff:
// zero backend to run today, and it scales to any number of simultaneous
// users because each browser does its own work. See README "Scaling beyond
// the hackathon" for the path to a shared backend once cross-device sync
// or an instructor dashboard is needed.
const Storage = {
  _key(suffix) { return `${CONFIG.storagePrefix}${suffix}`; },

  getUser() {
    try { return JSON.parse(localStorage.getItem(this._key('user'))); }
    catch { return null; }
  },
  setUser(user) {
    localStorage.setItem(this._key('user'), JSON.stringify(user));
  },
  clearUser() {
    localStorage.removeItem(this._key('user'));
  },

  _entriesKey(userId) { return this._key(`entries_${userId}`); },

  getAllEntries(userId) {
    try {
      const raw = localStorage.getItem(this._entriesKey(userId));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  },
  getEntry(userId, dateStr) {
    return this.getAllEntries(userId)[dateStr] || null;
  },
  saveEntry(userId, dateStr, entry) {
    const all = this.getAllEntries(userId);
    all[dateStr] = entry;
    localStorage.setItem(this._entriesKey(userId), JSON.stringify(all));
  },

  getSettings(userId) {
    try {
      const raw = localStorage.getItem(this._key(`settings_${userId}`));
      return raw ? JSON.parse(raw) : { reminderTime: '20:00', reminderEnabled: false };
    } catch { return { reminderTime: '20:00', reminderEnabled: false }; }
  },
  saveSettings(userId, settings) {
    localStorage.setItem(this._key(`settings_${userId}`), JSON.stringify(settings));
  },
};
