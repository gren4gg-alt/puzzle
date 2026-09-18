# Cozy Fit — AdSense + AdMob setup

The game is now wired so the **web build uses AdSense** and a **Capacitor native build uses AdMob**. The two paths are intentionally separated: AdSense is not loaded inside the native Capacitor WebView when the AdMob bridge is present.

## Ad behavior already wired into the game

- **Web / AdSense**
  - One responsive display-ad surface on the level-map/home screen.
  - Optional AdSense **H5 Games Ads** interstitial hook at the natural **Next level / Back to map** transition.
  - H5 interstitials are disabled by default because H5 Games Ads is a by-application AdSense product and requires approval.
- **Android / iOS / AdMob**
  - Anchored adaptive banner on the level-map/home screen only.
  - Banner is hidden during active puzzle play so it does not cover touch controls.
  - Interstitial is preloaded and can show only after a completed level when the player presses **Next puzzle** or **Back to map**.
- **Frequency / UX**
  - No interstitials during Levels 1–2.
  - One interstitial opportunity after every 3 eligible wins.
  - Minimum 180 seconds between interstitials.
  - If an ad is unavailable or fails, progression continues immediately.
- **Privacy**
  - Native: Google UMP consent is requested before AdMob requests are allowed.
  - Web: the privacy button is wired to Google's Privacy & Messaging revocation flow when configured.
- **Testing**
  - `ads-config.js` ships with `testMode: true`.
  - Native builds use Google's demo AdMob units while test mode is on.
  - Web AdSense stays inactive until you add your own publisher and display-slot IDs.

## 1. Configure player-facing release details and ad IDs

Edit `ads-config.js`. First fill the Settings / legal fields:

```js
appVersion: '1.0.0',
privacyPolicyUrl: 'https://YOUR_DOMAIN.example/cozy-fit/privacy',
termsUrl: 'https://YOUR_DOMAIN.example/cozy-fit/terms', // optional
supportEmail: 'support@YOUR_DOMAIN.example',            // optional
```

`privacyPolicyUrl` should point to a public HTTPS page before the app is submitted. The in-game **Settings → Privacy & ads** screen exposes that link and Google's privacy-choice entry point to players. Terms and support remain hidden until values are supplied.

Then configure the ad IDs.

For your website:

```js
web: {
  enabled: true,
  adsenseClient: 'ca-pub-YOUR_PUBLISHER_ID',
  displaySlot: 'YOUR_RESPONSIVE_DISPLAY_SLOT',
  h5GamesEnabled: false,
  frequencyHintSeconds: 180,
}
```

For native production builds, add your own banner/interstitial/rewarded ad unit IDs under both `android` and `ios` and then change:

```js
testMode: false
```

Do **not** publish with Google's demo unit IDs, and do not test by clicking your own live ads.

## 2. Install the Capacitor AdMob plugin

For Capacitor 8:

```bash
npm install @capacitor-community/admob
npx cap sync
```

If the app is still on Capacitor 7, use the matching plugin major:

```bash
npm install @capacitor-community/admob@7
npx cap sync
```

The web code talks to the plugin through Capacitor's injected native bridge, so the browser version remains plain HTML/CSS/JS.

## 3. Android app ID

In `android/app/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="@string/admob_app_id" />
```

In `android/app/src/main/res/values/strings.xml`:

```xml
<string name="admob_app_id">ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
```

Use the **AdMob app ID**, not an ad-unit ID.

Google's sample Android app ID for development is:

```text
ca-app-pub-3940256099942544~3347511713
```

## 4. iOS app ID

In `ios/App/App/Info.plist` add the AdMob application identifier and the SKAdNetwork entries required by the current Google Mobile Ads iOS setup guide.

At minimum the app identifier looks like:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
```

Google's sample iOS app ID for development is:

```text
ca-app-pub-3940256099942544~1458002511
```

Also use an accurate `NSUserTrackingUsageDescription` if your iOS privacy / IDFA setup needs App Tracking Transparency. Keep the current Google SKAdNetwork list from Google's iOS setup guide rather than copying an old static list.

## 5. Consent / privacy messages

### Native AdMob

In AdMob, create and publish the appropriate **Privacy & messaging / European regulations** message. The code follows the UMP flow:

1. initialize AdMob;
2. request consent info;
3. show a consent form if required;
4. request ads only when `canRequestAds` is true.

The in-game **Settings → Privacy & ads → Manage privacy choices** button opens `showPrivacyOptionsForm()` when Google says a privacy-options entry point is required. The button stays disabled when Google does not expose a privacy-options form.

### Web AdSense

Create/publish the appropriate message in **AdSense → Privacy & messaging**. When AdSense is configured, **Settings → Privacy & ads → Manage privacy choices** can call Google's consent-revocation flow.

Google requires a certified CMP for personalized ads in the EEA, UK and Switzerland. Google Privacy & messaging is one option.

## 6. Optional AdSense H5 Games Ads

The integration hook is already present, but it is OFF by default:

```js
h5GamesEnabled: false
```

AdSense H5 Games Ads is a separate, by-application product. After Google approves your account for it, switch the flag to `true`. The game will then use the H5 Ad Placement API only at the between-level transition, never in the middle of gameplay.

## 7. Current monetization strategy

The current defaults intentionally favor retention over maximum ad count:

- home/map banner;
- no gameplay banner;
- no startup interstitial;
- no tutorial interstitial;
- interstitial only after a user-completed level and an explicit navigation tap;
- 3-win cadence + 3-minute cooldown.

You can tune `interstitialEveryWins`, `minSecondsBetweenInterstitials`, and `skipInterstitialBeforeLevel` in `ads-config.js` without touching game logic.

## 8. Future rewarded-ad slot

Rewarded AdMob IDs are already included in configuration so we can later add a voluntary feature such as **Watch an ad for a stronger hint** or a cosmetic reward. It is intentionally not connected to the normal Help button yet so basic puzzle recovery remains free.

## Release checklist

- Publish a public HTTPS privacy-policy page and set `privacyPolicyUrl`.
- Set the release `appVersion`; optionally add `termsUrl` and `supportEmail`.
- Replace test/demo AdMob IDs with your production IDs.
- Set `testMode: false`.
- Add your AdSense publisher ID and responsive display slot.
- Keep `h5GamesEnabled: false` unless your AdSense account has H5 Games Ads approval.
- Publish AdMob/AdSense privacy messages and test consent flows.
- Test on real Android/iOS devices with test ads before production.
- Complete Play Console Data safety and your website/app privacy policy for the ad/consent behavior you actually use.
- If the game is child-directed or participates in Google Play Families, review the additional Families advertising requirements before release.
