'use strict';
const form = document.querySelector('#login-form');
const button = form.querySelector('button');
const error = document.querySelector('#login-error');
const sessionFailure = 'Votre mot de passe est accepté, mais la connexion n’a pas été conservée. Ouvrez le site directement dans un onglet de votre navigateur et autorisez ses cookies.';
// A successful POST must not lead back to an unexplained login form.
try {
  if (sessionStorage.getItem('clair_login_pending')) {
    sessionStorage.removeItem('clair_login_pending');
    error.textContent = sessionFailure;
  }
} catch (_) { /* Cookie checks below still work if browser storage is blocked. */ }
async function readResponse(response) {
  let result;
  try { result = await response.json(); }
  catch (_) { throw Error('Le serveur ne répond pas correctement. Réessayez dans un instant.'); }
  if (!response.ok) throw Error(result.error || 'Connexion impossible.');
  return result;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true; button.textContent = 'Connexion…'; error.textContent = '';
  try {
    await readResponse(await fetch('/api/login', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({password: form.elements.password.value})
    }));
    const session = await readResponse(await fetch('/api/session', {
      credentials: 'same-origin', cache: 'no-store'
    }));
    if (!session.authenticated) {
      throw Error(session.reason === 'cookie_missing' ? sessionFailure :
        'Votre mot de passe est accepté, mais la session est introuvable. Réessayez ; si cela persiste, signalez le code SESSION_INVALID.');
    }
    try { sessionStorage.setItem('clair_login_pending', '1'); } catch (_) {}
    location.replace('/');
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false; button.textContent = 'Accéder à mon budget →';
  }
});
