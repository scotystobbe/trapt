import React, { useState } from 'react';
import HamburgerMenu from '../../components/HamburgerMenu';
import Button from '../../components/Button';

const AVAILABLE_YEARS = [2018, 2019, 2020, 2021, 2022, 2023];

type ImportedRow = {
  title: string;
  artist: string;
  notes: string;
  rating: string;
};

type Match = {
  score: number;
  song: {
    id: number;
    title: string;
    artist: string;
    album?: string;
    rating?: number;
    notes?: string;
    spotifyLink?: string;
    artworkUrl?: string;
  };
};

type RowResult = {
  imported: ImportedRow;
  matches: Match[];
};

const ImportRatings: React.FC = () => {
  const [year, setYear] = useState<number | null>(null);
  const [results, setResults] = useState<RowResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<number, { selected: number | null; manualId?: number }>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const fetchMatches = async (selectedYear: number) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setChoices({});
    setSubmitStatus('idle');
    setSubmitMessage(null);
    try {
      const res = await fetch(`/api/admin/import-ratings?year=${selectedYear}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results);
      // Default to top match (index 0) for each row
      const defaultChoices: Record<number, { selected: number | null; manualId?: number }> = {};
      data.results.forEach((row: RowResult, idx: number) => {
        defaultChoices[idx] = { selected: row.matches.length > 0 ? 0 : null };
      });
      setChoices(defaultChoices);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  const handleChoice = (rowIdx: number, matchIdx: number | null, manualId?: number) => {
    setChoices((prev) => ({ ...prev, [rowIdx]: { selected: matchIdx, manualId } }));
  };

  const handleSubmit = async () => {
    setSubmitStatus('submitting');
    setSubmitMessage(null);
    // Build payload: only include rows with a selected match or manualId (not skipped)
    const payload = results.map((row, idx) => {
      const choice = choices[idx];
      if (!choice || (choice.selected === null && !choice.manualId)) return null;
      let songId: number | null = null;
      if (choice.selected !== null) {
        songId = row.matches[choice.selected]?.song?.id;
      } else if (choice.manualId) {
        songId = choice.manualId;
      }
      if (!songId) return null;
      return {
        songId,
        notes: row.imported.notes,
        rating: row.imported.rating,
      };
    }).filter(Boolean);
    if (payload.length === 0) {
      setSubmitStatus('error');
      setSubmitMessage('No matches selected to submit.');
      return;
    }
    try {
      const res = await fetch('/api/admin/import-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: payload }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSubmitStatus('success');
      setSubmitMessage('Ratings and notes successfully imported!');
    } catch (err: any) {
      setSubmitStatus('error');
      setSubmitMessage(err.message || 'Failed to submit updates.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <HamburgerMenu />
      <h1 className="text-2xl font-bold mb-4">Import Ratings (Admin)</h1>
      <div className="mb-4">
        <label className="mr-2 font-semibold">Select Year:</label>
        <select
          value={year ?? ''}
          onChange={(e) => {
            const y = Number(e.target.value);
            setYear(y);
            fetchMatches(y);
          }}
          className="border rounded px-2 py-1 text-black"
        >
          <option value="">-- Select --</option>
          {AVAILABLE_YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-400">{error}</div>}
      {results.length > 0 && (
        <div className="space-y-8">
          {results.map((row, idx) => (
            <div key={idx} className="border rounded p-4 bg-gray-50 bg-opacity-10">
              <div className="mb-1">
                <span className="text-xl font-bold block">{row.imported.title}</span>
                <span className="block text-sm text-gray-200">
                  by {row.imported.artist} | Rating: {row.imported.rating} | Notes: {row.imported.notes}
                </span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">Top Matches:</span>
                <ul>
                  {row.matches.map((match, mIdx) => (
                    <li key={match.song.id} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name={`match-${idx}`}
                        checked={choices[idx]?.selected === mIdx}
                        onChange={() => handleChoice(idx, mIdx)}
                      />
                      <span className={match.score === 1 ? 'font-bold' : ''}>
                        {match.song.title} by {match.song.artist} (Score: {match.score.toFixed(2)})
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center space-x-2 mt-1">
                    <input
                      type="radio"
                      name={`match-${idx}`}
                      checked={choices[idx]?.selected === null && choices[idx]?.manualId !== undefined}
                      onChange={() => handleChoice(idx, null)}
                    />
                    <span>Manual Song ID:</span>
                    <input
                      type="number"
                      className="border rounded px-1 py-0.5 w-24 text-black"
                      value={choices[idx]?.manualId ?? ''}
                      onChange={(e) => handleChoice(idx, null, Number(e.target.value))}
                      placeholder="Enter ID"
                    />
                  </li>
                  <li className="flex items-center space-x-2 mt-1">
                    <input
                      type="radio"
                      name={`match-${idx}`}
                      checked={choices[idx]?.selected === null && choices[idx]?.manualId === undefined}
                      onChange={() => handleChoice(idx, null, undefined)}
                    />
                    <span>Skip</span>
                  </li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
      {results.length > 0 && (
        <div className="mt-8">
          <Button variant="success" onClick={handleSubmit} disabled={submitStatus === 'submitting'}>
            {submitStatus === 'submitting' ? 'Submitting...' : 'Submit'}
          </Button>
          {submitStatus === 'success' && (
            <div className="mt-4 text-green-400">{submitMessage}</div>
          )}
          {submitStatus === 'error' && (
            <div className="mt-4 text-red-400">{submitMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportRatings; 