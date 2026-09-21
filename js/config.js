// Central config: brand tokens + SSO placeholders.
// To go live with real SSO, fill in the client IDs below. Until then,
// the "Continue with Demo Account" button lets you test everything today.
const CONFIG = {
  brand: {
    maroon: '#464038',   // app header background + heading ink
    saffron: '#E8842A',  // saffron orange - primary actions, accents
    cream: '#F7F2EA',    // warm off-white - page background
    headerText: '#E4DED4', // text color on the app header only
  },
  sso: {
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    microsoftClientId: 'YOUR_MICROSOFT_APP_CLIENT_ID',
    microsoftTenant: 'common',
    appleClientId: 'YOUR_APPLE_SERVICES_ID',
  },
  storagePrefix: 'yst_', // yoga-sadhana-tracker
};
