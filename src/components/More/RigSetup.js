/**
 * RigSetup.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { setActiveRig, useAvailableRigs } from '../../config/activeRig';
import MobileHeader from '../MobileHeader/MobileHeader';
import './More.css';
import RigPicker from './RigPicker';

/**
 * Render the first-time page: the user must pick a rig before the app opens. Nothing else can be
 * reached from here except signing out
 * @param {object} props - component props
 * @param {import('../../auth/auth').SessionUser} props.user - signed-in user
 * @param {() => void} props.onLogout - signs out
 * @returns {JSX.Element} rig setup page
 */
function RigSetup({ user, onLogout }) {
  const available = useAvailableRigs(user);
  return (
    <div className="more">
      <MobileHeader title="Select Rig" />
      <main className="more__content more__content--setup">
        <RigPicker
          activeRig=""
          rigs={available.rigs}
          status={available.status}
          error={available.error}
          onRetry={available.reload}
          intro="Choose the rig you work on. You can change it later in Settings."
          onSave={setActiveRig}
        />
        <button type="button" className="mr-link" onClick={onLogout}>
          Sign out
        </button>
      </main>
    </div>
  );
}

export default RigSetup;
