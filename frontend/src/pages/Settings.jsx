import { useNavigate } from 'react-router-dom';
import { MfaSettings } from '../components/MfaSettings.jsx';

export default function Settings({ user }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="font-semibold text-gray-900">MTD Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-500 hover:text-gray-800">← Dashboard</button>
        </div>
      </header>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Account settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your security preferences</p>
        </div>
        <MfaSettings />
      </div>
    </div>
  );
}
