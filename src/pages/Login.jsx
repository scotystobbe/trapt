import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import LogoHeader from '../components/LogoHeader';
import HamburgerMenu from '../components/HamburgerMenu';

export default function Login() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [masterCode, setMasterCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Redirect to home if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess(false);

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: resetIdentifier,
          masterCode,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }
      setResetSuccess(true);
      setResetIdentifier('');
      setMasterCode('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowResetPassword(false);
        setResetSuccess(false);
      }, 2000);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#18181b' }}>
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Don't render login form if already logged in (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#18181b' }}>
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-md mx-auto mt-24 p-6 rounded-xl text-white">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
          <input
            type="text"
            placeholder="Email or Username"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            className="w-full px-4 py-2 rounded bg-[#232326] border border-[#3f3f46] text-white focus:outline-none"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded bg-[#232326] border border-[#3f3f46] text-white focus:outline-none"
          />
          {error && <div className="text-red-400 mb-4 text-center">{error}</div>}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowResetPassword(true)}
              className="text-sm text-gray-400 hover:text-white"
            >
              Forgot Password?
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-500 transition shadow-none"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </div>
        </form>

        {/* Reset Password Modal */}
        {showResetPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
            <div className="bg-[#232326] rounded-xl shadow-lg p-6 w-full max-w-sm relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl"
                onClick={() => {
                  setShowResetPassword(false);
                  setResetIdentifier('');
                  setMasterCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setResetError('');
                  setResetSuccess(false);
                }}
                aria-label="Close"
              >
                &times;
              </button>
              <h3 className="text-xl font-bold mb-4 text-center text-white">Reset Password</h3>
              {resetSuccess ? (
                <div className="text-green-400 text-center py-4">
                  Password reset successfully! You can now log in.
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Email or Username"
                    value={resetIdentifier}
                    onChange={e => setResetIdentifier(e.target.value)}
                    className="w-full px-4 py-2 rounded bg-[#18181b] border border-[#3f3f46] text-white focus:outline-none"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoFocus
                    required
                  />
                  <input
                    type="text"
                    placeholder="Master Code"
                    value={masterCode}
                    onChange={e => setMasterCode(e.target.value)}
                    className="w-full px-4 py-2 rounded bg-[#18181b] border border-[#3f3f46] text-white focus:outline-none"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded bg-[#18181b] border border-[#3f3f46] text-white focus:outline-none"
                    style={{ fontSize: '16px' }}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded bg-[#18181b] border border-[#3f3f46] text-white focus:outline-none"
                    style={{ fontSize: '16px' }}
                    required
                  />
                  {resetError && <div className="text-red-400 text-sm text-center">{resetError}</div>}
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 rounded bg-gray-700 text-white font-semibold hover:bg-gray-600 transition"
                      onClick={() => {
                        setShowResetPassword(false);
                        setResetIdentifier('');
                        setMasterCode('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setResetError('');
                        setResetSuccess(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-500 transition"
                      disabled={resetLoading}
                    >
                      {resetLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 