import { authService } from '../services/api.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
export default function ConnectHmrc() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="flex justify-center mb-6"><div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center"><span className="text-white text-2xl font-bold">H</span></div></div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect to HMRC</h1>
        <p className="text-gray-500 mb-8 text-sm">Grant permission to submit tax returns via Making Tax Digital.</p>
        <button onClick={() => authService.connectHmrc(user?.id || 'user')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition">Connect your HMRC account</button>
        <p className="text-xs text-center text-gray-400 mt-4">You'll be redirected to the official HMRC login page. We never see your HMRC password.</p>
      </div>
    </div>
  );
}
