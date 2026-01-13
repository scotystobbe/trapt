import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import { FaRegEdit } from 'react-icons/fa';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [editingUsername, setEditingUsername] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  if (!user) return <div className="text-center mt-12 text-gray-400">Not logged in.</div>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (editingUsername && username === user.username) {
      setEditingUsername(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ username: editingUsername ? username : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      setMessage('Profile updated successfully!');
      setEditingUsername(false);
      setUser({ ...user, username });
    } catch (err) {
      if (!(editingUsername && err.message && err.message.includes('No changes to update'))) {
        setError(err.message);
      } else {
        setEditingUsername(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSave = async () => {
    setMessage('');
    setError('');
    if (username === user.username) {
      setEditingUsername(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      setMessage('Profile updated successfully!');
      setEditingUsername(false);
      setUser({ ...user, username });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      setMessage('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#18181b' }}>
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-md mx-auto mt-24 p-6 rounded-xl text-white">
        <h2 className="text-2xl font-bold mb-6 text-center">Profile</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="font-semibold">Username</label>
          {!editingUsername ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{user.username}</span>
              <button
                type="button"
                className="text-gray-400 hover:text-white p-1 rounded"
                onClick={() => { setUsername(user.username); setEditingUsername(true); }}
                aria-label="Edit Username"
              >
                <FaRegEdit />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="px-4 py-2 rounded bg-[#232326] border border-[#3f3f46] focus:outline-none text-white"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
              />
              <button
                type="button"
                className="px-3 py-1 rounded bg-green-600 text-white font-semibold hover:bg-green-500 transition"
                disabled={loading}
                onClick={handleUsernameSave}
              >
                Save
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-gray-700 text-white font-semibold hover:bg-gray-600 transition"
                onClick={() => { setEditingUsername(false); setUsername(user.username); setError(''); setMessage(''); }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          )}
          <div className="mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded bg-[#232326] hover:bg-[#3f3f46] font-semibold transition"
              onClick={() => setShowPasswordModal(true)}
            >
              Change Password
            </button>
          </div>
          {message && <div className="text-green-400 text-center">{message}</div>}
          {error && <div className="text-red-400 text-center">{error}</div>}
        </form>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
            <div className="bg-[#232326] rounded-xl shadow-lg p-6 w-full max-w-sm relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl"
                onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setError(''); setMessage(''); }}
                aria-label="Close"
              >
                &times;
              </button>
              <h3 className="text-xl font-bold mb-4 text-center">Change Password</h3>
              <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
                <input
                  type="password"
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="px-4 py-2 rounded bg-[#232326] border border-[#3f3f46] focus:outline-none text-white"
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="px-4 py-2 rounded bg-[#232326] border border-[#3f3f46] focus:outline-none text-white"
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="px-4 py-2 rounded bg-[#232326] border border-[#3f3f46] focus:outline-none text-white"
                />
                <div className="flex gap-2 mt-2 justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-gray-700 text-white font-semibold hover:bg-gray-600 transition"
                    onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setError(''); setMessage(''); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-500 transition"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 