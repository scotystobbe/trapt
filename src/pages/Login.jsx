import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import LogoHeader from '../components/LogoHeader';
import HamburgerMenu from '../components/HamburgerMenu';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          <button
            type="submit"
            className="self-end px-6 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-500 transition shadow-none"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
} 