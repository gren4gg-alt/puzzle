(() => {
  'use strict';

  const cfg = window.COZY_ADS_CONFIG || {};
  const TEST_UNITS = {
    android: {
      banner: 'ca-app-pub-3940256099942544/9214589741',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
    },
    ios: {
      banner: 'ca-app-pub-3940256099942544/2435281174',
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
      rewarded: 'ca-app-pub-3940256099942544/1712485313',
    },
  };

  const state = {
    initialized: false,
    mode: 'none',
    platform: 'web',
    screen: 'home',
    canRequestAds: false,
    nativeBannerCreated: false,
    nativeBannerVisible: false,
    interstitialReady: false,
    interstitialPreparing: false,
    interstitialShowing: false,
    interstitialResolve: null,
    interstitialFallback: null,
    webScriptLoaded: false,
    webDisplayLoaded: false,
    soundEnabled: true,
    consentStatus: 'UNKNOWN',
    privacyOptionsAvailable: false,
    privacyOptionsRequired: false,
    webConfigured: false,
    testMode: !!cfg.testMode,
    adsEnabled: cfg.enabled !== false,
    modalOpen: false,
  };

  function log(...args) {
    if (cfg.debug) console.info('[CozyAds]', ...args);
  }

  function capPlatform() {
    const cap = window.Capacitor;
    if (!cap) return 'web';
    try {
      if (typeof cap.getPlatform === 'function') {
        const value = cap.getPlatform();
        if (value) return value;
      }
    } catch (_) {}
    if (cap.platform) return cap.platform;
    // Native Capacitor injects registered plugins into Capacitor.Plugins even
    // when a bundled copy of @capacitor/core is not present in this static app.
    if (cap.Plugins?.AdMob) {
      const ua = navigator.userAgent || '';
      if (/android/i.test(ua)) return 'android';
      if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
      return 'android';
    }
    return 'web';
  }

  function isNative() {
    const platform = capPlatform();
    return platform === 'android' || platform === 'ios';
  }

  function admobPlugin() {
    return window.Capacitor?.Plugins?.AdMob || null;
  }

  function getStore(store, key, fallback = null) {
    try {
      const value = store.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function setStore(store, key, value) {
    try { store.setItem(key, String(value)); } catch (_) {}
  }

  function winsSinceInterstitial() {
    try { return Number(sessionStorage.getItem('cozy-ads-wins-since-interstitial') || '0') || 0; }
    catch (_) { return 0; }
  }

  function setWinsSinceInterstitial(value) {
    try { sessionStorage.setItem('cozy-ads-wins-since-interstitial', String(Math.max(0, value | 0))); }
    catch (_) {}
  }

  function lastInterstitialAt() {
    try { return Number(sessionStorage.getItem('cozy-ads-last-interstitial-at') || '0') || 0; }
    catch (_) { return 0; }
  }

  function markInterstitialShown() {
    setWinsSinceInterstitial(0);
    try { sessionStorage.setItem('cozy-ads-last-interstitial-at', String(Date.now())); }
    catch (_) {}
  }

  function updatePrivacyButton(show, required = false) {
    state.privacyOptionsAvailable = !!show;
    state.privacyOptionsRequired = !!required;
    const button = document.getElementById('privacyAdsBtn');
    if (button) {
      button.disabled = !show;
      button.setAttribute('aria-disabled', String(!show));
    }
    emitStatus();
  }

  function setNativeBannerInset(height = 0) {
    const h = Math.max(0, Number(height) || 0);
    document.documentElement.style.setProperty('--native-ad-height', `${h}px`);
    document.body.classList.toggle('native-banner-visible', h > 0);
  }

  function nativeIds() {
    const platform = state.platform === 'ios' ? 'ios' : 'android';
    if (cfg.testMode) return TEST_UNITS[platform];
    return cfg.admob?.[platform] || {};
  }

  function validId(id, prefix) {
    return typeof id === 'string' && id.startsWith(prefix);
  }

  function dispatch(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function publicStatus() {
    return {
      ...state,
      winsSinceInterstitial: winsSinceInterstitial(),
    };
  }

  function emitStatus() {
    dispatch('cozy-ad-status', publicStatus());
  }

  async function prepareNativeInterstitial() {
    if (state.mode !== 'native' || !state.canRequestAds || state.interstitialPreparing || state.interstitialReady) return;
    const AdMob = admobPlugin();
    const adId = nativeIds().interstitial;
    if (!AdMob || !validId(adId, 'ca-app-pub-')) return;

    state.interstitialPreparing = true;
    try {
      await AdMob.prepareInterstitial({
        adId,
        isTesting: !!cfg.testMode,
        npa: !!cfg.requestNonPersonalizedAds,
        immersiveMode: true,
      });
      // The Loaded event normally sets this. Keep this fallback for bridge versions
      // that resolve prepareInterstitial only after a successful load.
      state.interstitialReady = true;
    } catch (error) {
      log('interstitial prepare failed', error);
      state.interstitialReady = false;
    } finally {
      state.interstitialPreparing = false;
    }
  }

  async function showNativeBanner() {
    if (state.mode !== 'native' || !state.canRequestAds || !cfg.admob?.bannerOnHome) return;
    const AdMob = admobPlugin();
    const adId = nativeIds().banner;
    if (!AdMob || !validId(adId, 'ca-app-pub-')) return;

    try {
      if (state.nativeBannerCreated) {
        await AdMob.resumeBanner();
      } else {
        await AdMob.showBanner({
          adId,
          adSize: 'ADAPTIVE_BANNER',
          position: 'BOTTOM_CENTER',
          margin: 0,
          isTesting: !!cfg.testMode,
          npa: !!cfg.requestNonPersonalizedAds,
        });
        state.nativeBannerCreated = true;
      }
      state.nativeBannerVisible = true;
    } catch (error) {
      log('banner show failed', error);
      setNativeBannerInset(0);
    }
  }

  async function hideNativeBanner() {
    if (state.mode !== 'native' || !state.nativeBannerCreated || !state.nativeBannerVisible) {
      setNativeBannerInset(0);
      return;
    }
    const AdMob = admobPlugin();
    try { await AdMob?.hideBanner(); } catch (error) { log('banner hide failed', error); }
    state.nativeBannerVisible = false;
    setNativeBannerInset(0);
  }

  function finishNativeInterstitial(shown) {
    if (state.interstitialFallback) clearTimeout(state.interstitialFallback);
    state.interstitialFallback = null;
    state.interstitialShowing = false;
    state.interstitialReady = false;
    dispatch('cozy-ad-end', { format: 'interstitial', platform: state.platform, shown: !!shown });
    const resolve = state.interstitialResolve;
    state.interstitialResolve = null;
    if (resolve) resolve(!!shown);
    setTimeout(prepareNativeInterstitial, 450);
  }

  async function showNativeInterstitial() {
    if (state.mode !== 'native' || !state.canRequestAds || state.interstitialShowing) return false;
    if (!state.interstitialReady) {
      prepareNativeInterstitial();
      return false;
    }
    const AdMob = admobPlugin();
    if (!AdMob) return false;

    state.interstitialShowing = true;
    state.interstitialReady = false;
    dispatch('cozy-ad-start', { format: 'interstitial', platform: state.platform });

    return new Promise(async resolve => {
      state.interstitialResolve = resolve;
      state.interstitialFallback = setTimeout(() => finishNativeInterstitial(false), 15000);
      try {
        await AdMob.showInterstitial();
      } catch (error) {
        log('interstitial show failed', error);
        finishNativeInterstitial(false);
      }
    });
  }

  async function initNative() {
    state.mode = 'native';
    state.platform = capPlatform();
    state.consentStatus = 'CHECKING';
    emitStatus();
    const AdMob = admobPlugin();
    if (!AdMob || cfg.admob?.enabled === false) {
      state.consentStatus = 'UNAVAILABLE';
      log('AdMob plugin is not installed/registered');
      emitStatus();
      return;
    }

    try {
      await AdMob.addListener('bannerAdSizeChanged', info => {
        if (state.nativeBannerVisible) setNativeBannerInset(info?.height || 0);
      });
      await AdMob.addListener('bannerAdFailedToLoad', () => setNativeBannerInset(0));
      await AdMob.addListener('interstitialAdLoaded', () => {
        state.interstitialReady = true;
        state.interstitialPreparing = false;
      });
      await AdMob.addListener('interstitialAdFailedToLoad', () => {
        state.interstitialReady = false;
        state.interstitialPreparing = false;
      });
      await AdMob.addListener('interstitialAdDismissed', () => finishNativeInterstitial(true));
      await AdMob.addListener('interstitialAdFailedToShow', () => finishNativeInterstitial(false));

      await AdMob.initialize();

      let consent = await AdMob.requestConsentInfo({
        tagForUnderAgeOfConsent: !!cfg.tagForUnderAgeOfConsent,
      });
      if (consent?.isConsentFormAvailable && consent?.status === 'REQUIRED') {
        consent = await AdMob.showConsentForm();
      }

      state.canRequestAds = !!consent?.canRequestAds;
      state.consentStatus = String(consent?.status || (state.canRequestAds ? 'READY' : 'UNKNOWN'));
      const privacyRequired = consent?.privacyOptionsRequirementStatus === 'REQUIRED';
      updatePrivacyButton(privacyRequired, privacyRequired);

      if (!state.canRequestAds) {
        log('UMP has not allowed ad requests yet');
        emitStatus();
        return;
      }
      emitStatus();

      await prepareNativeInterstitial();
      if (state.screen === 'home') await showNativeBanner();
    } catch (error) {
      state.consentStatus = 'ERROR';
      log('native ad init failed', error);
      emitStatus();
    }
  }

  function loadWebAdScript() {
    const web = cfg.web || {};
    const client = web.adsenseClient || '';
    if (!validId(client, 'ca-pub-') || location.protocol === 'file:') return;

    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adBreak || function (options) { window.adsbygoogle.push(options); };
    window.adConfig = window.adConfig || function (options) { window.adsbygoogle.push(options); };

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.dataset.adClient = client;
    script.dataset.adFrequencyHint = `${Math.max(30, Number(web.frequencyHintSeconds) || 180)}s`;
    if (cfg.testMode && web.h5GamesEnabled) script.dataset.adbreakTest = 'on';
    script.addEventListener('load', () => {
      state.webScriptLoaded = true;
      state.consentStatus = 'MANAGED_BY_GOOGLE_CMP';
      updatePrivacyButton(true, false);
      renderWebDisplayAd();
      emitStatus();
    });
    script.addEventListener('error', () => {
      state.consentStatus = 'ERROR';
      log('AdSense script failed to load');
      emitStatus();
    });
    document.head.appendChild(script);

    if (web.h5GamesEnabled) {
      try {
        window.adConfig({ preloadAdBreaks: 'on', sound: state.soundEnabled ? 'on' : 'off' });
      } catch (_) {}
    }
  }

  function renderWebDisplayAd() {
    const web = cfg.web || {};
    const slotHost = document.getElementById('webAdSlot');
    if (!slotHost || state.webDisplayLoaded || !state.webScriptLoaded) return;
    if (!validId(web.adsenseClient, 'ca-pub-') || !/^\d+$/.test(String(web.displaySlot || ''))) return;

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle cozy-web-ad-unit';
    ins.style.display = 'block';
    ins.dataset.adClient = web.adsenseClient;
    ins.dataset.adSlot = String(web.displaySlot);
    ins.dataset.adFormat = 'auto';
    ins.dataset.fullWidthResponsive = 'true';
    slotHost.querySelector('.web-ad-stage')?.appendChild(ins);
    slotHost.hidden = false;
    state.webDisplayLoaded = true;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (error) { log('display ad request failed', error); }
  }

  async function showWebInterstitial() {
    if (state.mode !== 'web' || !cfg.web?.h5GamesEnabled || !state.webScriptLoaded || typeof window.adBreak !== 'function') return false;

    dispatch('cozy-ad-start', { format: 'interstitial', platform: 'web' });
    return new Promise(resolve => {
      let finished = false;
      const done = shown => {
        if (finished) return;
        finished = true;
        dispatch('cozy-ad-end', { format: 'interstitial', platform: 'web', shown: !!shown });
        resolve(!!shown);
      };
      const timeout = setTimeout(() => done(false), 10000);
      try {
        window.adBreak({
          type: 'next',
          name: 'cozy-fit-between-levels',
          beforeAd: () => {},
          afterAd: () => {},
          adBreakDone: info => {
            clearTimeout(timeout);
            done(info?.breakStatus === 'viewed');
          },
        });
      } catch (error) {
        clearTimeout(timeout);
        log('H5 adBreak failed', error);
        done(false);
      }
    });
  }

  function initWeb() {
    state.mode = 'web';
    state.platform = 'web';
    state.canRequestAds = true;
    state.webConfigured = validId(cfg.web?.adsenseClient || '', 'ca-pub-') && /^\d+$/.test(String(cfg.web?.displaySlot || ''));
    state.consentStatus = state.webConfigured ? 'LOADING_GOOGLE_CMP' : 'NOT_CONFIGURED';
    emitStatus();
    if (cfg.web?.enabled !== false) loadWebAdScript();
  }

  function eligibleForInterstitial(meta = {}) {
    if (cfg.enabled === false) return false;
    const completedLevel = Number(meta.completedLevelIndex);
    const minLevel = Math.max(1, Number(cfg.skipInterstitialBeforeLevel) || 3) - 1;
    if (!Number.isInteger(completedLevel) || completedLevel < minLevel) return false;

    const every = Math.max(1, Number(cfg.interstitialEveryWins) || 3);
    if (winsSinceInterstitial() < every) return false;

    const cooldown = Math.max(30, Number(cfg.minSecondsBetweenInterstitials) || 180) * 1000;
    if (Date.now() - lastInterstitialAt() < cooldown) return false;
    return true;
  }

  async function beforeLevelTransition(meta = {}) {
    if (!eligibleForInterstitial(meta)) return false;
    let shown = false;
    if (state.mode === 'native') shown = await showNativeInterstitial();
    else if (state.mode === 'web') shown = await showWebInterstitial();
    if (shown) markInterstitialShown();
    return shown;
  }

  async function setScreen(screen) {
    state.screen = screen === 'game' ? 'game' : 'home';
    if (state.mode !== 'native' || !state.canRequestAds) return;
    if (state.screen === 'home' && !state.modalOpen) await showNativeBanner();
    else await hideNativeBanner();
  }

  async function setModalOpen(open) {
    state.modalOpen = !!open;
    if (state.mode !== 'native' || !state.canRequestAds) return;
    if (state.modalOpen) await hideNativeBanner();
    else if (state.screen === 'home') await showNativeBanner();
  }

  function noteLevelComplete(levelIndex) {
    const minLevel = Math.max(1, Number(cfg.skipInterstitialBeforeLevel) || 3) - 1;
    if (Number(levelIndex) < minLevel) return;
    setWinsSinceInterstitial(winsSinceInterstitial() + 1);
  }

  async function openPrivacyOptions() {
    if (!state.privacyOptionsAvailable) return false;

    if (state.mode === 'native') {
      const AdMob = admobPlugin();
      if (!AdMob) return false;
      try {
        await AdMob.showPrivacyOptionsForm();
        try {
          const consent = await AdMob.requestConsentInfo({
            tagForUnderAgeOfConsent: !!cfg.tagForUnderAgeOfConsent,
          });
          state.canRequestAds = !!consent?.canRequestAds;
          state.consentStatus = String(consent?.status || (state.canRequestAds ? 'READY' : 'UNKNOWN'));
          const required = consent?.privacyOptionsRequirementStatus === 'REQUIRED';
          updatePrivacyButton(required, required);
        } catch (_) {
          emitStatus();
        }
        return true;
      } catch (error) {
        log('privacy form failed', error);
        emitStatus();
        return false;
      }
    }

    if (!state.webScriptLoaded) return false;
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    if (typeof window.googlefc.showRevocationMessage === 'function') {
      window.googlefc.showRevocationMessage();
      return true;
    }
    window.googlefc.callbackQueue.push({
      CONSENT_API_READY: () => {
        if (typeof window.googlefc.showRevocationMessage === 'function') {
          window.googlefc.showRevocationMessage();
        }
      },
    });
    return true;
  }

  async function setSoundEnabled(enabled) {
    state.soundEnabled = !!enabled;
    if (state.mode === 'native') {
      try { await admobPlugin()?.setApplicationMuted({ muted: !state.soundEnabled }); } catch (_) {}
    } else if (cfg.web?.h5GamesEnabled && typeof window.adConfig === 'function') {
      try { window.adConfig({ sound: state.soundEnabled ? 'on' : 'off' }); } catch (_) {}
    }
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    state.platform = capPlatform();
    if (cfg.enabled === false) {
      state.mode = isNative() ? 'native' : 'web';
      state.consentStatus = 'ADS_DISABLED';
      emitStatus();
      return;
    }
    if (isNative()) await initNative();
    else initWeb();
  }

  window.CozyAds = {
    init,
    setScreen,
    setModalOpen,
    noteLevelComplete,
    beforeLevelTransition,
    openPrivacyOptions,
    setSoundEnabled,
    getStatus: publicStatus,
  };

  // In Capacitor, the native bridge is injected before page scripts. On the web,
  // this simply prepares AdSense if production IDs have been supplied.
  init();
})();
