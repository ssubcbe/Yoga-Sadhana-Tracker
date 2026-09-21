// Sign-in page logic. Real Google / Microsoft / Apple SSO wiring is included
// and turns itself on automatically once you drop real client IDs into
// js/config.js. Until then, "Continue with Demo Account" exercises the exact
// same session/storage path so the rest of the app can be tested today.
// Minimum data collected: display name + email, nothing else.

function isConfigured(value) {
  return value && !value.startsWith('YOUR_');
}

function decodeJwt(token) {
  const payload = token.split('.')[1];
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

function completeSignIn(name, email, provider) {
  Storage.setUser({ name, email, provider, signedInAt: new Date().toISOString() });
  window.location.href = 'app.html';
}

function initGoogleSignIn() {
  const btn = document.getElementById('google-btn');
  if (!isConfigured(CONFIG.sso.googleClientId)) {
    btn.title = 'Add a real Google Client ID in js/config.js to enable this';
    btn.addEventListener('click', () => showNotConfigured('Google'));
    return;
  }
  google.accounts.id.initialize({
    client_id: CONFIG.sso.googleClientId,
    callback: (response) => {
      const profile = decodeJwt(response.credential);
      completeSignIn(profile.name, profile.email, 'google');
    },
  });
  google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', width: 260 });
}

function initMicrosoftSignIn() {
  const btn = document.getElementById('microsoft-btn');
  if (!isConfigured(CONFIG.sso.microsoftClientId)) {
    btn.addEventListener('click', () => showNotConfigured('Microsoft'));
    return;
  }
  const msalConfig = {
    auth: {
      clientId: CONFIG.sso.microsoftClientId,
      authority: `https://login.microsoftonline.com/${CONFIG.sso.microsoftTenant}`,
      redirectUri: window.location.origin + window.location.pathname,
    },
  };
  const msalInstance = new msal.PublicClientApplication(msalConfig);
  btn.addEventListener('click', async () => {
    try {
      const result = await msalInstance.loginPopup({ scopes: ['User.Read'] });
      completeSignIn(result.account.name, result.account.username, 'microsoft');
    } catch (e) {
      console.error(e);
      alert('Microsoft sign-in failed. See console for details.');
    }
  });
}

function initAppleSignIn() {
  const btn = document.getElementById('apple-btn');
  if (!isConfigured(CONFIG.sso.appleClientId)) {
    btn.addEventListener('click', () => showNotConfigured('Apple'));
    return;
  }
  btn.addEventListener('click', () => {
    AppleID.auth.init({
      clientId: CONFIG.sso.appleClientId,
      scope: 'name email',
      redirectURI: window.location.origin + window.location.pathname,
      usePopup: true,
    });
    AppleID.auth.signIn().then((res) => {
      const name = res.user ? `${res.user.name.firstName} ${res.user.name.lastName}` : 'Apple User';
      const email = res.user ? res.user.email : decodeJwt(res.authorization.id_token).email;
      completeSignIn(name, email, 'apple');
    }).catch((e) => console.error(e));
  });
}

function showNotConfigured(provider) {
  document.getElementById('sso-note').textContent =
    `${provider} sign-in needs a real client ID in js/config.js first. Use "Continue with Demo Account" to try the app right now.`;
}

function initDemoSignIn() {
  const form = document.getElementById('demo-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('demo-name').value.trim();
    const email = document.getElementById('demo-email').value.trim();
    if (!name || !email) return;
    completeSignIn(name, email, 'demo');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const existing = Storage.getUser();
  if (existing) {
    window.location.href = 'app.html';
    return;
  }
  initDemoSignIn();
  try { initGoogleSignIn(); } catch (e) { console.warn('Google SDK not ready', e); }
  try { initMicrosoftSignIn(); } catch (e) { console.warn('MSAL SDK not ready', e); }
  try { initAppleSignIn(); } catch (e) { console.warn('Apple SDK not ready', e); }
});
