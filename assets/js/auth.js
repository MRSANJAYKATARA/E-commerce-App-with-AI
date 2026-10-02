/* ExamLegacy — authentication & session.
   Firebase Google Sign-In. The ID token is attached to API calls; the server
   verifies it and maps to a MySQL user. Client state is never authoritative. */
window.EL = window.EL || {};

EL.auth = (function () {
  var firebaseUser = null;
  var profile = null;       // MySQL user profile from /me
  var listeners = [];
  var ready = false;

  function init() {
    if (typeof firebase === 'undefined') {
      return Promise.reject(new Error('Authentication service temporarily unavailable. Please try again.'));
    }
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(EL.FIREBASE_CONFIG);
    }
    return new Promise(function (resolve) {
      firebase.auth().onAuthStateChanged(function (user) {
        firebaseUser = user || null;
        ready = true;
        if (user) {
          // Sync/refresh the server profile.
          EL.api.get('/me').then(function (p) { profile = p.user; }).catch(function () { profile = null; })
            .finally(function () { emit(); resolve(user); });
        } else {
          profile = null;
          emit();
          resolve(null);
        }
      });
    });
  }

  function emit() { listeners.forEach(function (cb) { try { cb(firebaseUser, profile); } catch (e) {} }); }

  return {
    init: init,
    onChange: function (cb) { listeners.push(cb); },
    isReady: function () { return ready; },
    user: function () { return firebaseUser; },
    profile: function () {
      if (profile) return profile;
      if (firebaseUser) {
        return {
          name: firebaseUser.displayName || 'Student',
          email: firebaseUser.email || '',
          avatar_url: firebaseUser.photoURL || '',
          firebase_uid: firebaseUser.uid,
          role: 'user',                      // NEVER infer role client-side; server sets via /me
          status: 'active',
          wallet_balance_paise: 0,
          ai_credit_balance: 50,
          vip_active: 0
        };
      }
      return null;
    },
    refreshProfile: function () {
      return EL.api.get('/me').then(function (p) { profile = p.user; emit(); return profile; }).catch(function () { return EL.auth.profile(); });
    },
    currentToken: async function () {
      if (!firebaseUser) return null;
      try { return await firebaseUser.getIdToken(/* forceRefresh */ false); }
      catch (e) { return null; }
    },
    signInWithGoogle: async function () {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      var result = await firebase.auth().signInWithPopup(provider);
      firebaseUser = result.user;
      ready = true;
      try {
        var meRes = await EL.api.get('/me');
        if (meRes && meRes.user) profile = meRes.user;
      } catch (err) {
        // Safe graceful degradation: profile remains populated from firebaseUser
      }
      emit();
      return EL.auth.profile();
    },
    signOut: async function () {
      await firebase.auth().signOut();
      firebaseUser = null; profile = null; emit();
    }
  };
})();
