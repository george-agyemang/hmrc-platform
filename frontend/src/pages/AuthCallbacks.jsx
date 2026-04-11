import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
export function AuthSuccess() {
  const navigate = useNavigate();
  useEffect(() => { const t = setTimeout(() => navigate('/dashboard'), 3000); return () => clearTimeout(t); }, [navigate]);
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center"><div className="text-5xl mb-4">✅</div><h1 className="text-2xl font-bold text-gray-900 mb-2">HMRC Connected!</h1><p className="text-gray-500 mb-4">Your HMRC account has been successfully linked.</p><p className="text-sm text-gray-400">Redirecting to dashboard...</p></div></div>;
}
export function AuthError() {
  const reason = new URLSearchParams(window.location.search).get('reason') || 'unknown';
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center"><div className="text-5xl mb-4">❌</div><h1 className="text-2xl font-bold text-gray-900 mb-2">Connection Failed</h1><p className="text-gray-500 mb-6">Something went wrong. Please try again.</p><Link to="/connect" className="inline-block py-3 px-6 bg-emerald-600 text-white rounded-xl font-semibold">Try Again</Link><p className="mt-4 text-xs text-gray-400">Error: {reason}</p></div></div>;
}
