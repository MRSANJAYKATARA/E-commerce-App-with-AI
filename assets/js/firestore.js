/* ExamLegacy — Cloud Firestore client synchronization.
 * Real-time updates for user profile, wallet balance, AI credits, and notifications.
 */
window.EL = window.EL || {};

EL.firestore = (function () {
  var db = null;
  var userUnsub = null;
  var notifUnsub = null;

  function init() {
    if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
      try {
        db = firebase.firestore();
      } catch (e) {}
    }
  }

  function listenUser(uid, onUpdate) {
    if (!db || !uid) return;
    if (userUnsub) { userUnsub(); userUnsub = null; }
    try {
      userUnsub = db.collection('users').doc(uid).onSnapshot(function (doc) {
        if (doc.exists) {
          var data = doc.data();
          if (typeof onUpdate === 'function') onUpdate(data);
        }
      }, function (err) {
        // Silently ignore permission/offline errors (hybrid fallback to MySQL)
      });
    } catch (e) {}
  }

  function stop() {
    if (userUnsub) { userUnsub(); userUnsub = null; }
    if (notifUnsub) { notifUnsub(); notifUnsub = null; }
  }

  return {
    init: init,
    getDb: function () { return db; },
    listenUser: listenUser,
    stop: stop
  };
})();
