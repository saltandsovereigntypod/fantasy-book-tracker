(() => {
  'use strict';

  const URL = 'https://udxatwvbxpefbdhnsycf.supabase.co';
  const KEY = 'sb_publishable_HPoFuihcUtFr1Dsj1cLpwA_8R2z6snG';
  const SITE = 'https://saltandsovereigntypod.github.io/the-empyrean-book-tracker/';
  const STORAGE_KEY = 'warCollegeArchiveStateV2';
  const LEGACY_KEY = 'warCollegeArchiveStateV1';
  const nativeSetItem = Storage.prototype.setItem;
  let supabase;
  let user;
  let cloudReady = false;
  let appLoaded = false;
  let saveTimer;
  let mode = 'signin';
  const ASSET_VERSION = '20260801-2';
  const APP_SCRIPTS = ['app.js', 'hotfix.js', 'runtime-patches.js', 'investigation-features.js', 'infinite-wall.js', 'mind-map.js', 'dossier-experience.js'];

  const $ = id => document.getElementById(id);
  const setMessage = text => { if ($('authMessage')) $('authMessage').textContent = text; };
  const setSync = text => { if ($('syncStatus')) $('syncStatus').textContent = text; };
  const openAuth = () => { $('authModal')?.classList.add('is-open'); $('authModal')?.setAttribute('aria-hidden', 'false'); };
  const closeAuth = () => { $('authModal')?.classList.remove('is-open'); $('authModal')?.setAttribute('aria-hidden', 'true'); };

  function setMode(next) {
    mode = next;
    document.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.authMode === next));
    document.querySelector('.auth-name-field')?.classList.toggle('is-hidden', next !== 'signup');
    document.querySelector('.auth-invite-field')?.classList.toggle('is-hidden', next !== 'signup');
    $('authSubmit').textContent = next === 'signup' ? 'Create Account' : 'Sign In';
  }

  function getLocalRaw() {
    return localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
  }

  function hasMeaningfulData(raw) {
    if (!raw) return false;
    try {
      const value = JSON.parse(raw);
      return Boolean(value.onboarded || value.books?.length || value.theories?.length || value.suspicions?.length || value.wallCards?.length);
    } catch {
      return false;
    }
  }

  async function saveCloud(raw) {
    if (!cloudReady || !user || !raw) return;
    let state;
    try { state = JSON.parse(raw); } catch { return; }
    setSync('Saving…');
    const { error } = await supabase.from('archive_states').upsert({ user_id: user.id, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      console.error(error);
      setSync('Cloud save failed');
      return;
    }
    setSync('Cloud saved');
  }

  function queueSave(raw) {
    if (!cloudReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCloud(raw), 650);
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    nativeSetItem.call(this, key, value);
    if (this === localStorage && key === STORAGE_KEY) queueSave(value);
  };

  async function claimInvite(account) {
    const { data: profile, error } = await supabase.from('profiles').select('invite_claimed').eq('id', account.id).maybeSingle();
    if (error) throw error;
    if (profile?.invite_claimed) return;
    const code = account.user_metadata?.invite_code;
    if (!code) throw new Error('This account has not claimed an invitation code.');
    const { data, error: claimError } = await supabase.rpc('claim_invite_code', { p_code: code });
    if (claimError || !data) throw new Error('The invitation code could not be claimed. Contact the archive owner.');
  }

  async function loadCloud() {
    setSync('Loading cloud…');
    const { data, error } = await supabase.from('archive_states').select('state').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const local = getLocalRaw();
    if (data?.state) {
      nativeSetItem.call(localStorage, STORAGE_KEY, JSON.stringify(data.state));
    } else if (hasMeaningfulData(local)) {
      if (confirm('Unarchived records were found on this device. Import them into your cloud account?')) {
        nativeSetItem.call(localStorage, STORAGE_KEY, local);
        cloudReady = true;
        await saveCloud(local);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    cloudReady = true;
    setSync('Cloud saved');
  }

  function loadScript(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${file}?v=${ASSET_VERSION}`;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${file}`));
      document.body.appendChild(script);
    });
  }

  async function loadApp() {
    if (appLoaded) return;
    appLoaded = true;
    try {
      // These classic scripts intentionally share app.js's global lexical
      // environment. Awaiting each load prevents patches from racing app boot
      // or overriding one another in a stale order.
      for (const file of APP_SCRIPTS) await loadScript(file);
      renderAll();
      bindAppControls();
      closeAuth();
      document.body.classList.remove('cloud-locked');
    } catch (error) {
      console.error('Production runtime failed to load:', error);
      appLoaded = false;
      setMessage('The tracker could not load its latest runtime. Refresh the page.');
      openAuth();
    }
  }

  function bindAppControls() {
    $('signOutBtn')?.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await saveCloud(localStorage.getItem(STORAGE_KEY));
      await supabase.auth.signOut();
      location.reload();
    }, true);

    $('resetApp')?.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!confirm('Erase your cloud archive and local copy? This cannot be undone.')) return;
      await supabase.from('archive_states').delete().eq('user_id', user.id);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
      location.reload();
    }, true);
  }

  async function enter(account) {
    user = account;
    await claimInvite(account);
    await loadCloud();
    loadApp();
  }

  async function submitAuth() {
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    if (!email || password.length < 8) return setMessage('Enter a valid email and a password of at least eight characters.');
    $('authSubmit').disabled = true;
    try {
      if (mode === 'signup') {
        const displayName = $('authName').value.trim();
        const invite = $('authInvite').value.trim();
        if (!displayName || !invite) throw new Error('A display name and invitation code are required.');
        const { data: valid, error: validationError } = await supabase.rpc('validate_invite_code', { p_code: invite });
        if (validationError || !valid) throw new Error('That invitation code is invalid or has reached its limit.');
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: SITE, data: { display_name: displayName, invite_code: invite } } });
        if (error) throw error;
        if (data.session?.user) await enter(data.session.user);
        else setMessage('Check your email to confirm your account, then return here to enter the Archive.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await enter(data.user);
      }
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Authentication failed.');
    } finally {
      $('authSubmit').disabled = false;
    }
  }

  async function sendReset() {
    const email = $('authEmail').value.trim();
    if (!email) return setMessage('Enter your email first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE });
    setMessage(error ? error.message : 'A password-reset link has been sent.');
  }

  async function saveNewPassword() {
    const password = $('newPassword').value;
    if (password.length < 8) return setMessage('Use at least eight characters.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMessage(error.message);
    document.querySelector('.auth-reset-fields')?.classList.add('is-hidden');
    setMessage('Password updated. Your archive is ready.');
  }

  function bindAuth() {
    document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));
    $('authSubmit').addEventListener('click', submitAuth);
    $('forgotPassword').addEventListener('click', sendReset);
    $('saveNewPassword').addEventListener('click', saveNewPassword);
    $('authPassword').addEventListener('keydown', event => { if (event.key === 'Enter') submitAuth(); });
  }

  async function boot() {
    document.body.classList.add('cloud-locked');
    openAuth();
    bindAuth();
    if (!window.supabase) return setMessage('The cloud library could not load. Check your connection and refresh.');
    supabase = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') {
        document.querySelector('.auth-reset-fields')?.classList.remove('is-hidden');
        setMessage('Choose a new password for your archive.');
        openAuth();
      }
    });
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return setMessage(error.message);
    if (session?.user) {
      try { await enter(session.user); }
      catch (error) { console.error(error); setMessage(error.message || 'Your archive could not be opened.'); }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
