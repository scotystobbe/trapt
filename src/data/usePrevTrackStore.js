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
    }
  )
);

export default usePrevTrackStore; 