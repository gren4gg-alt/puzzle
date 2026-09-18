/*
 * Cozy Fit ad configuration.
 *
 * Safe defaults:
 * - Native builds use Google's demo AdMob units while testMode is true.
 * - Web ads stay OFF until you add your AdSense publisher + slot IDs.
 * - H5 Games interstitials stay OFF until Google approves your AdSense account
 *   for H5 Games Ads and you turn h5GamesEnabled on.
 *
 * Before release, replace the production AdMob IDs below and set testMode:false.
 */
window.COZY_ADS_CONFIG = {
  enabled: false,
  testMode: true,

  // Player-facing legal/support details shown in Settings.
  // Replace these before release.
  appVersion: '0.12.0',
  privacyPolicyUrl: 'https://broshere.com/privacy.html',
  termsUrl: 'https://broshere.com/terms.html',
  supportEmail: 'podugenerations@gmail.com',

  // Set this only if your legal / Play Families setup requires it.
  tagForUnderAgeOfConsent: false,
  requestNonPersonalizedAds: false,

  // Natural-break interstitial policy. The game never shows one during play.
  interstitialEveryWins: 3,
  minSecondsBetweenInterstitials: 180,
  skipInterstitialBeforeLevel: 3,

  web: {
    enabled: true,
    // Example: ca-pub-1234567890123456
    adsenseClient: '',
    // Responsive display ad unit shown on the level-map/home screen.
    displaySlot: '',

    // AdSense H5 Games Ads is a separate, by-application product.
    // Turn this on only after your account is approved for it.
    h5GamesEnabled: false,
    frequencyHintSeconds: 180,
  },

  admob: {
    enabled: true,
    bannerOnHome: true,

    // Production IDs. Leave blank while testMode is true.
    android: {
      banner: '',
      interstitial: '',
      rewarded: '',
    },
    ios: {
      banner: '',
      interstitial: '',
      rewarded: '',
    },
  },
};
