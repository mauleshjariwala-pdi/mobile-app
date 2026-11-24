/**
 * Login.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import Icon from '../Icon/Icon';
import './Login.css';

// Constants
// White lettering, as on the Auth0 login page
const LOGO_SRC = `${process.env.PUBLIC_URL}/precision-drilling-logo-light.svg`;
const BUSY_TEXT = { loading: 'Checking your session…', redirecting: 'Opening sign-in…' };

/**
 * Render the screen shown before the app: the user signs in on the Auth0 page, so this only shows
 * progress while the session is checked or the browser goes to Auth0, or why sign-in cannot run
 * @param {object} props - component props
 * @param {'loading' | 'redirecting' | 'unavailable'} props.status - session state
 * @param {string} [props.error] - why sign-in is unavailable, e.g. "Sign-in needs HTTPS"
 * @returns {JSX.Element} sign-in screen
 */
function Login({ status, error = '' }) {
  const isUnavailable = status === 'unavailable';
  return (
    <div className="login">
      <main className="login__main" aria-busy={!isUnavailable}>
        <header className="login__brand">
          <img className="login__logo" src={LOGO_SRC} alt="Precision Drilling" width={170} height={70} />
          <p className="login__product">Precision Drilling Digital Twin</p>
        </header>
        {isUnavailable ? (
          <p className="login__error" role="alert">
            <Icon name="warning" size={18} strokeWidth={2.2} />
            {error || 'Sign-in is not available here.'}
          </p>
        ) : (
          <p className="login__status" role="status">
            <span className="login__spinner" aria-hidden="true" />
            {BUSY_TEXT[status] ?? BUSY_TEXT.loading}
          </p>
        )}
      </main>
    </div>
  );
}

export default Login;
