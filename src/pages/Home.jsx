import React from "react";
import { Link } from 'react-router-dom';
import HamburgerMenu from '../components/HamburgerMenu';
import LogoHeader from '../components/LogoHeader';
import { FaCompass, FaSpotify } from 'react-icons/fa';
import { useAuth } from '../components/AuthProvider';

// Home page navigation hub for Browse and Now Playing sections
export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div style={{ backgroundColor: '#18181b' }} className="min-h-screen">
      <LogoHeader>
        <HamburgerMenu />
      </LogoHeader>
      <div className="max-w-4xl mx-auto w-full p-4 flex flex-col items-center min-h-[70vh]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl mt-4">
          <Link to="/now-playing" className="bg-green-900 hover:bg-green-800 transition rounded-2xl flex flex-col items-center justify-center p-12 shadow-lg border-2 border-green-700">
            <FaSpotify className="w-16 h-16 mb-4 opacity-80 text-green-400" />
            <h2 className="text-2xl font-bold text-white mb-2">Now Playing</h2>
            <p className="text-gray-400 text-center">See what's playing on Spotify</p>
          </Link>
          <Link to="/browse" className="bg-gray-800 hover:bg-gray-700 transition rounded-2xl flex flex-col items-center justify-center p-12 shadow-lg border-2 border-gray-700">
            <FaCompass className="w-16 h-16 mb-4 opacity-80 text-blue-400" />
            <h2 className="text-2xl font-bold text-white mb-2">Browse</h2>
            <p className="text-gray-400 text-center">Explore playlists and songs</p>
          </Link>
          {/* Apple Music Converter - Hidden for now */}
          {/* {isAdmin && (
            <Link to="/admin" className="bg-pink-900 hover:bg-pink-800 transition rounded-2xl flex flex-col items-center justify-center p-12 shadow-lg border-2 border-pink-700">
              <FaApple className="w-16 h-16 mb-4 opacity-80 text-pink-400" />
              <h2 className="text-2xl font-bold text-white mb-2">Convert Playlist</h2>
              <p className="text-gray-400 text-center">Apple Music to Spotify</p>
            </Link>
          )} */}
        </div>
      </div>
    </div>
  );
}