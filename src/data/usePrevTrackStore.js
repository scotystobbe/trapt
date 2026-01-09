import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePrevTrackStore = create(
  persist(
    (set) => ({
      prevTrack: null,
      prevDbSong: null,
      setPrevTrack: (track) => set({ prevTrack: track }),
      setPrevDbSong: (dbSong) => set({ prevDbSong: dbSong }),
    }),
    {
      name: 'prev-track-storage', // unique name for localStorage key
      // Custom storage to handle serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            return JSON.parse(str);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (err) {
            console.error('Failed to save previous track to localStorage:', err);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

export default usePrevTrackStore; 