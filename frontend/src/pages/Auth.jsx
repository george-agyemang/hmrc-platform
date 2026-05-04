import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService, mfaService } from '../services/api.jsx';

export function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await authService.login(form);
      if (res.mfaRequired) {
        setMfaToken(res.mfaToken);
        setMfaRequired(true);
      } else {
        onLogin(res.user);
        navigate('/dashboard');
      }
    } catch (err) { setError(err.response?.data?.error || 'Login failed.'); }
    finally { setLoading(false); }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await mfaService.validate(mfaToken, mfaCode);
      localStorage.setItem('auth_token', res.token);
      onLogin(res.user);
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.error || 'Invalid code. Try again.'); }
    finally { setLoading(false); }
  };

  if (mfaRequired) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-center mb-6"><a href="/"><div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center"><span className="text-white text-xl font-bold">8</span></div></a></div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">Two-factor authentication</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Enter the 6-digit code from your authenticator app</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Authenticator code</label>
            <input type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} required value={mfaCode} onChange={e => setMfaCode(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="000 000" autoFocus/>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-semibold transition text-sm">{loading ? 'Verifying...' : 'Verify'}</button>
        </form>
        <button onClick={() => { setMfaRequired(false); setMfaCode(''); setError(''); }} className="w-full text-center text-sm text-gray-500 mt-4 hover:text-gray-700">← Back to login</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-center mb-6"><a href="/"><div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center"><span className="text-white text-xl font-bold">8</span></div></a></div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">Welcome back</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Sign in to your Eight Submissions account</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" required value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="you@example.com"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" autoComplete="current-password" required value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••••"/></div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-semibold transition text-sm">{loading?'Signing in...':'Sign in'}</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">No account? <Link to="/register" className="text-emerald-600 hover:underline font-medium">Create one</Link></p>
      </div>
    </div>
  );
}

export function Register({ onLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { const { user } = await authService.register(form); onLogin(user); navigate('/dashboard'); }
    catch (err) { setError(err.response?.data?.error || 'Registration failed.'); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-center mb-6"><a href="/"><div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center"><span className="text-white text-xl font-bold">8</span></div></a></div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">Create account</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Get started with Eight Submissions</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Your name"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" required value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="you@example.com"/></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" autoComplete="new-password" required value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••••"/></div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-semibold transition text-sm">{loading?'Creating account...':'Create account'}</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">Already have an account? <Link to="/login" className="text-emerald-600 hover:underline font-medium">Sign in</Link></p>
      </div>
    </div>
  );
}
