import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BrowseTopics from './pages/BrowseTopics';
import AdminUsers from './pages/AdminUsers';
import MissingTopics from './pages/MissingTopics';

function App() {
  const location = useLocation();
  const { user, loading, login, logout, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-blue-600">SpecCon Academy</span>
              <span className="text-sm text-gray-500">Textbook Mapping</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === '/'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/topics"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === '/topics'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Browse Topics
              </Link>
              <Link
                to="/missing-topics"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === '/missing-topics'
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Missing Textbook Topics
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/users"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === '/admin/users'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Manage Users
                </Link>
              )}
              <div className="border-l border-gray-200 pl-4 flex items-center gap-3">
                <span className="text-sm text-gray-500">{user.name}</span>
                <button
                  onClick={logout}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/topics" element={<BrowseTopics />} />
          <Route path="/missing-topics" element={<MissingTopics />} />
          {isAdmin && <Route path="/admin/users" element={<AdminUsers />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
