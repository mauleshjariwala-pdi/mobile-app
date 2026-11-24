/**
 * NoRigAccess.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import Icon from '../Icon/Icon';
import './Login.css';

// Constants
// White lettering, as on the Auth0 login page
const LOGO_SRC = `${process.env.PUBLIC_URL}/precision-drilling-logo-light.svg`;

/**
 * Render the page for a signed-in user whose account has no rig yet. Every Designer call would
 * answer 403, so the app explains it and offers to sign out instead
 * @param {object} props - component props
 * @param {import('../../auth/auth').SessionUser} props.user - signed-in user
 * @param {() => void} props.onLogout - signs out, e.g. to try another account
 * @returns {JSX.Element} no rig access page
 */
function NoRigAccess({ user, onLogout }) {
  const name = user?.login || user?.email || 'Your account';
  return (
    <div className="login">
      <main className="login__main">
        <header className="login__brand">
          <img className="login__logo" src={LOGO_SRC} alt="Precision Drilling" width={170} height={70} />
          <p className="login__product">Precision Drilling Digital Twin</p>
        </header>
        <section className="login__card" aria-labelledby="no-rig-title">
          <h1 id="no-rig-title" className="login__title login__title--small">
            Rig Access Restricted
          </h1>
          <hr className="login__divider" />
          <p className="login__error" role="alert">
            <Icon name="warning" size={18} strokeWidth={2.2} />
            {name} is signed in, but has no rigs assigned yet. Ask your administrator to give your account access to
            your rig, then sign in again.
          </p>
          <button type="button" className="login__submit" onClick={onLogout}>
            Sign out
          </button>
        </section>
      </main>
    </div>
  );
}

export default NoRigAccess;
