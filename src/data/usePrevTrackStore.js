import { create } from 'zustand';

const usePrevTrackStore = create(set => ({
  prevTrack: null,
  prevDbSong: null,
  setPrevTrack: (track) => set({ prevTrack: track }),
  setPrevDbSong: (dbSong) => set({ prevDbSong: dbSong }),
}));

export default usePrevTrackStore; 