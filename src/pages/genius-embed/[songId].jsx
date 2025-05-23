import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function GeniusEmbedPage() {
  const { songId } = useParams();
  const [embedContent, setEmbedContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const embedRef = useRef(null);

  useEffect(() => {
    async function fetchEmbed() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/genius?action=lyrics&song_id=${songId}`);
        if (!res.ok) throw new Error('Failed to fetch embed');
        const data = await res.json();
        setEmbedContent(data.embed_content);
      } catch (err) {
        setError('Could not load Genius embed.');
      } finally {
        setLoading(false);
      }
    }
    fetchEmbed();
  }, [songId]);

  useEffect(() => {
    if (embedContent && embedRef.current) {
      embedRef.current.innerHTML = '';
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = embedContent;
      Array.from(tempDiv.childNodes).forEach(node => {
        if (node.nodeName !== 'SCRIPT') {
          embedRef.current.appendChild(node);
        }
      });
      const scriptTag = tempDiv.querySelector('script');
      if (scriptTag && scriptTag.src) {
        let src = scriptTag.src.replace(/^http:/, 'https:');
        if (!src.startsWith('https://')) {
          src = 'https:' + src.replace(/^\/\//, '');
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.setAttribute('data-genius-embed', 'true');
        embedRef.current.appendChild(script);
      }
    }
  }, [embedContent]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900">
      <h1 className="text-2xl font-bold text-white mb-6">Genius Lyrics Embed</h1>
      {loading && <div className="text-gray-300">Loading...</div>}
      {error && (
        <div className="text-red-500 mb-4">{error}<br />
          <a
            href={`https://genius.com/songs/${songId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-yellow-400"
          >
            View on Genius
          </a>
        </div>
      )}
      <div ref={embedRef} className="genius-embed w-full max-w-xl" />
    </div>
  );
} 