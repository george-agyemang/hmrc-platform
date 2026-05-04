import { useState, useEffect } from 'react';
import { mfaService, authService } from '../services/api.jsx';

const QRCode = ({ uri }) => (
  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`} alt="Scan with your authenticator app" className="mx-auto rounded-xl border border-gray-200" width={200} height={200} />
);

export function MfaSettings() {
  const [status, setStatus] = useState(null);
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authService.me().then(u => setStatus(u.mfaEnabled ? 'enabled' : 'idle')).catch(() => setStatus('idle'));
  }, []);

  const handleSetup = async () => {
    setError(''); setLoading(true);
    try { const res = await mfaService.setup(); setQrUri(res.uri); setSecret(res.secret); setStatus('setup'); }
    catch (e) { setError(e.response?.data?.error || 'Failed to start setup.'); }
    finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await mfaService.verifySetup(code); setStatus('enabled'); setSuccess('Two-factor authentication is now enabled.'); setCode(''); }
    catch (e) { setError(e.response?.data?.error || 'Invalid code. Try again.'); }
    finally { setLoading(false); }
  };

  const handleDisable = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication?')) return;
    setError(''); setLoading(true);
    try { await mfaService.disable(); setStatus('idle'); setSuccess('Two-factor authentication has been disabled.'); }
    catch (e) { setError(e.response?.data?.error || 'Failed to disable MFA.'); }
    finally { setLoading(false); }
  };

  if (status === null) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Two-factor authentication</h2>
          <p className="text-xs text-gray-500">Add an extra layer of security to your account</p>
        </div>
        {status === 'enabled' && <span className="ml-auto text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">Enabled</span>}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 mb-4 text-sm">{success}</div>}
      {status === 'idle' && (
        <div>
          <p className="text-sm text-gray-600 mb-4">Use an authenticator app like Google Authenticator or Authy to generate login codes.</p>
          <button onClick={handleSetup} disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition">{loading ? 'Setting up...' : 'Enable 2FA'}</button>
        </div>
      )}
      {status === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
          <QRCode uri={qrUri} />
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Can't scan? Enter this key manually:</p>
            <p className="text-sm font-mono font-medium text-gray-800 break-all">{secret}</p>
          </div>
          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
              <input type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} required autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="000 000" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition">{loading ? 'Verifying...' : 'Confirm & Enable'}</button>
              <button type="button" onClick={() => { setStatus('idle'); setCode(''); setError(''); }} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            </div>
          </form>
        </div>
      )}
      {status === 'enabled' && (
        <div>
          <p className="text-sm text-gray-600 mb-4">Your account is protected with an authenticator app. You'll be asked for a code each time you sign in.</p>
          <button onClick={handleDisable} disabled={loading} className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 rounded-xl text-sm font-medium transition">{loading ? 'Disabling...' : 'Disable 2FA'}</button>
        </div>
      )}
    </div>
  );
}
