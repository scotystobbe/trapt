import React from "react";
import { useState, useEffect, useRef } from 'react';
import StarRating from './StarRating';
import { FaRegEdit, FaComment, FaTrash } from 'react-icons/fa';
import { mutate } from 'swr';
import { SiGenius } from 'react-icons/si';
import { useAuth } from './AuthProvider';

export default function SongCard({ song, playlistName, onSongUpdate }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isViewer = user?.role === 'VIEWER';
  const [rating, setRating] = useState(song.rating);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(song.notes || '');
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [respondingTo, setRespondingTo] = useState(null);
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const responseTextareaRef = useRef(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const saveSongUpdate = async (fields) => {
    if (!isAdmin) return;
    setError('');
    try {
      const res = await fetch('/api/songs', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ id: song.id, ...fields }),
      });
      if (!res.ok) throw new Error('Failed to save');
      if (onSongUpdate) onSongUpdate();
      mutate('/api/playlists');
    } catch (err) {
      setError('Could not save changes.');
    }
  };

  const handleRatingChange = (newRating) => {
    if (!isAdmin) return;
    if (newRating === 1 && rating === 1) {
      setRating(null);
      saveSongUpdate({ rating: null });
    } else {
      setRating(newRating);
      saveSongUpdate({ rating: newRating });
    }
  };

  const handleNoteSave = () => {
    if (!isAdmin) return;
    setEditing(false);
    saveSongUpdate({ notes });
  };

  // Add helper function to open Genius app or fallback to web
  function openGeniusAppOrWeb(songId, webUrl) {
    const appUrl = `genius://songs/${songId}`;
    const timeout = setTimeout(() => {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }, 800);
    window.location = appUrl;
    window.addEventListener('pagehide', () => clearTimeout(timeout), { once: true });
  }

  const handleGeniusClick = async (e) => {
    e.preventDefault();
    
    // If we have a stored Genius ID, use it directly
    if (song.geniusSongId && song.geniusUrl) {
      openGeniusAppOrWeb(song.geniusSongId, song.geniusUrl);
      return;
    }
    
    // Otherwise, search (only for admin users on desktop)
    if (!isAdmin) {
      // Non-admin users can't search, show message or open web search
      const searchUrl = `https://genius.com/search?q=${encodeURIComponent(song.artist + ' ' + song.title)}`;
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    
    setSearchLoading(true);
    setSearchError('');
    setShowResults(false);
    try {
      const q = encodeURIComponent(`${song.artist} ${song.title}`);
      const res = await fetch(`/api/genius?action=search&q=${q}`);
      if (!res.ok) throw new Error('Search failed');
      const hits = await res.json();
      // Try to find an exact match
      const exact = hits.find(h => {
        const t = h.result.title.trim().toLowerCase();
        const a = h.result.primary_artist.name.trim().toLowerCase();
        return t === song.title.trim().toLowerCase() && a === song.artist.trim().toLowerCase();
      });
      if (exact) {
        // Store the match for future use
        await saveSongUpdate({ geniusSongId: exact.result.id, geniusUrl: exact.result.url });
        openGeniusAppOrWeb(exact.result.id, exact.result.url);
      } else {
        setSearchResults(hits);
        setShowResults(true);
      }
    } catch (err) {
      setSearchError('Could not search Genius.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleResultClick = async (hit) => {
    // Store the selected match for future use
    if (isAdmin) {
      await saveSongUpdate({ geniusSongId: hit.result.id, geniusUrl: hit.result.url });
    }
    openGeniusAppOrWeb(hit.result.id, hit.result.url);
    setShowResults(false);
  };

  const fetchComments = async () => {
    if (loadingComments) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/comments?songId=${song.id}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (showComments && comments.length === 0 && !loadingComments) {
      fetchComments();
    }
  }, [showComments, song.id]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpenId) return;
    function handleClickOutside(event) {
      if (!event.target.closest('.relative')) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!responseText.trim() || !user) return;
    
    setSubmittingResponse(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          songId: song.id,
          content: responseText.trim(),
          parentCommentId: respondingTo || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to submit response');
      setResponseText('');
      setRespondingTo(null);
      await fetchComments();
      mutate('/api/playlists');
    } catch (err) {
      console.error('Error submitting response:', err);
      setError('Could not submit response.');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${month}/${day}/${year} ${displayHours}:${displayMinutes} ${ampm}`;
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.content);
    setRespondingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editingText.trim()) return;
    
    try {
      const res = await fetch('/api/comments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          id: commentId,
          content: editingText.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to update comment');
      setEditingCommentId(null);
      setEditingText('');
      await fetchComments();
      mutate('/api/playlists');
    } catch (err) {
      console.error('Error updating comment:', err);
      setError('Could not update comment.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this response?')) return;
    
    setDeletingCommentId(commentId);
    try {
      const res = await fetch('/api/comments', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ id: commentId }),
      });
      if (!res.ok) throw new Error('Failed to delete comment');
      await fetchComments();
      mutate('/api/playlists');
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError('Could not delete comment.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div style={{ backgroundColor: '#27272a' }} className="p-3 sm:p-4 rounded-xl flex flex-row gap-2 sm:gap-4 items-start">
      <div className="flex-shrink-0 w-16 h-16 sm:w-24 sm:h-24 rounded-md overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#3f3f46' }}>
        {song.artworkUrl ? (
          <img src={song.artworkUrl} alt={song.title} className="object-cover w-full h-full" />
        ) : (
          <span className="text-gray-400 text-xs">No Art</span>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-between w-full min-w-0">
        <div className="flex flex-col gap-1 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">{song.title}</h2>
              <button
                onClick={handleGeniusClick}
                title="View on Genius"
              className="text-yellow-400 hover:text-yellow-300 text-lg sm:text-xl flex-shrink-0"
                disabled={searchLoading}
              >
                <SiGenius />
              </button>
            </div>
          <p className="text-xs sm:text-sm text-gray-300 truncate">{song.artist}</p>
          <p className="text-xs sm:text-sm text-gray-400 italic truncate">{playlistName}</p>
        </div>
        <div className="mt-2 sm:mt-3 flex flex-col gap-2">
          <div className="flex items-center">
            <StarRating rating={rating} onRatingChange={isAdmin ? handleRatingChange : undefined} size={28} />
          </div>
          <div className="text-xs sm:text-sm text-gray-300">
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
                  style={{ fontSize: '16px' }}
                  disabled={!isAdmin}
                />
                {isAdmin && (
                  <button
                    onClick={handleNoteSave}
                    className="self-end px-2 py-1 sm:px-3 sm:py-1 bg-blue-600 rounded hover:bg-blue-500 text-xs sm:text-sm"
                  >Save</button>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <p className={`whitespace-pre-wrap flex-1 break-words ${notes ? '' : 'text-gray-500'}`}>{notes || <em>No notes</em>}</p>
                {isAdmin && (
                  <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-white flex-shrink-0 mt-0.5">
                    <FaRegEdit className="text-sm" />
                  </button>
                )}
              </div>
            )}
          </div>
          {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
          
          {/* Comments Section */}
          {(notes || (song.commentCount > 0) || (song.responseCount > 0)) && (
            <div className="mt-2 sm:mt-3 border-t border-gray-700 pt-2 sm:pt-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                {((song.commentCount > 0) || (song.responseCount > 0)) ? (
                  <button
                    onClick={() => {
                      setShowComments(!showComments);
                      if (!showComments) fetchComments();
                    }}
                    className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-400 hover:text-white"
                  >
                    <FaComment className="text-sm sm:text-base" />
                    <span className="whitespace-nowrap">
                      {song.responseCount > 0 && `${song.responseCount} response${song.responseCount !== 1 ? 's' : ''}`}
                      {song.commentCount > 0 && song.responseCount === 0 && `${song.commentCount} response${song.commentCount !== 1 ? 's' : ''}`}
                    </span>
                  </button>
                ) : (
                  <div></div>
                )}
                {(isViewer || isAdmin) && notes && !showComments && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setShowComments(true);
                      if (comments.length === 0) fetchComments();
                      setRespondingTo(null);
                      setResponseText('');
                    }}
                    className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-600 rounded hover:bg-blue-500 text-xs sm:text-sm text-white whitespace-nowrap"
                  >
                    Add Response
                  </button>
                )}
              </div>
              
              {showComments && (
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {loadingComments ? (
                    <div className="text-gray-400 text-xs sm:text-sm">Loading comments...</div>
                  ) : (
                    <>
                      {(() => {
                        // Flatten all responses (comments + replies) and sort by date (oldest first)
                        const allResponses = [];
                        comments.forEach(comment => {
                          allResponses.push({ ...comment, isReply: false });
                          if (comment.replies && comment.replies.length > 0) {
                            comment.replies.forEach(reply => {
                              allResponses.push({ ...reply, isReply: true, parentCommentId: comment.id });
                            });
                          }
                        });
                        allResponses.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                        return allResponses.map(response => (
                          <div key={response.id} className="bg-[#1f1f23] rounded p-2 sm:p-3">
                            <div className="flex items-start justify-between mb-1 sm:mb-2 gap-2">
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <span className="text-white font-semibold text-xs sm:text-sm truncate">
                                  {response.user.username || response.user.name || 'Anonymous'}
                                </span>
                                {response.user.role === 'ADMIN' && (
                                  <span className="text-[10px] sm:text-xs bg-blue-600 px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">ADMIN</span>
                                )}
                                <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{formatDate(response.createdAt)}</span>
                              </div>
                              {user && response.user.id === user.id && (
                                <div className="relative flex-shrink-0">
                                  <button
                                    onClick={() => setMenuOpenId(menuOpenId === response.id ? null : response.id)}
                                    className="text-gray-400 hover:text-white p-1 text-xs sm:text-sm"
                                    disabled={editingCommentId === response.id || deletingCommentId === response.id}
                                  >
                                    ⋮
                                  </button>
                                  {menuOpenId === response.id && (
                                    <div className="absolute right-0 top-full mt-1 bg-[#27272a] border border-[#3f3f46] rounded shadow-lg z-10 min-w-[100px] sm:min-w-[120px]">
                                      <button
                                        onClick={() => {
                                          handleEditComment(response);
                                          setMenuOpenId(null);
                                        }}
                                        className="block w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-300 hover:bg-[#3f3f46]"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDeleteComment(response.id);
                                          setMenuOpenId(null);
                                        }}
                                        className="block w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-red-400 hover:bg-[#3f3f46]"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {editingCommentId === response.id ? (
                              <div className="flex flex-col gap-2 mt-2">
                                <textarea
                                  value={editingText}
                                  onChange={e => setEditingText(e.target.value)}
                                  className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
                                  rows={3}
                                  style={{ fontSize: '16px' }}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(response.id)}
                                    disabled={!editingText.trim()}
                                    className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-600 rounded hover:bg-blue-500 text-xs sm:text-sm disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs sm:text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-300 text-xs sm:text-sm whitespace-pre-wrap break-words">{response.content}</p>
                            )}
                            {/* Response form for VIEWER and ADMIN users */}
                            {(isViewer || isAdmin) && notes && !response.isReply && (
                              <div className="mt-2">
                                {respondingTo === response.id ? (
                                  <form onSubmit={handleSubmitResponse} className="flex flex-col gap-2">
                                    <div className="text-[10px] sm:text-xs text-gray-400 mb-1">
                                      Responding to original comment
                                    </div>
                                    <textarea
                                      value={responseText}
                                      onChange={e => setResponseText(e.target.value)}
                                      placeholder="Write a response..."
                                      className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
                                      rows={2}
                                      style={{ fontSize: '16px' }}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="submit"
                                        disabled={!responseText.trim() || submittingResponse}
                                        className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-600 rounded hover:bg-blue-500 text-xs sm:text-sm disabled:opacity-50"
                                      >
                                        {submittingResponse ? 'Submitting...' : 'Submit'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRespondingTo(null);
                                          setResponseText('');
                                        }}
                                        className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs sm:text-sm"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <button
                                    onClick={() => setRespondingTo(response.id)}
                                    className="text-[10px] sm:text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    Respond
                                  </button>
                                )}
                              </div>
                            )}
                            {/* Response form for replies */}
                            {(isViewer || isAdmin) && notes && response.isReply && (
                              <div className="mt-2">
                                {respondingTo === response.id ? (
                                  <form onSubmit={handleSubmitResponse} className="flex flex-col gap-2">
                                    <div className="text-[10px] sm:text-xs text-gray-400 mb-1">
                                      Responding to a response
                                    </div>
                                    <textarea
                                      value={responseText}
                                      onChange={e => setResponseText(e.target.value)}
                                      placeholder="Write a response..."
                                      className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
                                      rows={2}
                                      style={{ fontSize: '16px' }}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="submit"
                                        disabled={!responseText.trim() || submittingResponse}
                                        className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-600 rounded hover:bg-blue-500 text-xs sm:text-sm disabled:opacity-50"
                                      >
                                        {submittingResponse ? 'Submitting...' : 'Submit'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRespondingTo(null);
                                          setResponseText('');
                                        }}
                                        className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs sm:text-sm"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <button
                                    onClick={() => setRespondingTo(response.id)}
                                    className="text-[10px] sm:text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    Respond
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                      
                      {/* Response form for VIEWER and ADMIN users - always show if there's a note and not responding to a specific comment */}
                      {(isViewer || isAdmin) && notes && !respondingTo && (
                        <div className="mt-2 sm:mt-3 bg-[#1f1f23] rounded p-2 sm:p-3">
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            handleSubmitResponse(e);
                          }} className="flex flex-col gap-2">
                            <textarea
                              ref={responseTextareaRef}
                              value={responseText}
                              onChange={e => setResponseText(e.target.value)}
                              placeholder={comments.length === 0 ? "Respond to this note..." : "Add a response..."}
                              className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white"
                              style={{ fontSize: '16px' }}
                              rows={3}
                            />
                            <button
                              type="submit"
                              disabled={!responseText.trim() || submittingResponse}
                              className="self-end px-2 py-1 sm:px-3 sm:py-1 bg-blue-600 rounded hover:bg-blue-500 text-xs sm:text-sm disabled:opacity-50"
                            >
                              {submittingResponse ? 'Submitting...' : 'Submit Response'}
                            </button>
                          </form>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {showResults && (
          <div className="absolute z-50 bg-zinc-900 border border-yellow-400 rounded shadow-lg mt-2 p-4 w-80">
            <div className="text-gray-300 mb-2">Select the correct song:</div>
            {searchError && <div className="text-red-500 mb-2">{searchError}</div>}
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map(hit => (
                <li key={hit.result.id} className="flex items-center gap-2 bg-zinc-800 rounded p-2 cursor-pointer hover:bg-zinc-700" onClick={() => handleResultClick(hit)}>
                  {hit.result.song_art_image_thumbnail_url && (
                    <img src={hit.result.song_art_image_thumbnail_url} alt="art" className="w-10 h-10 rounded" />
                  )}
                  <div>
                    <div className="text-white font-semibold">{hit.result.title}</div>
                    <div className="text-gray-400 text-sm">{hit.result.primary_artist.name}</div>
                  </div>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowResults(false)} className="mt-2 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}