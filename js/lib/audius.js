/**
 * Audius — fetching music from the public Audius API (https://docs.audius.org).
 * No key is needed; every request names the app instead.
 *
 *   const tracks = await fetchTrendingTracks('Pop');
 *   tracks[0]  →  { id, title, artist, artwork, link, streamUrl }
 *
 * `streamUrl` can be given straight to an <audio> element.
 */

const API_URL = 'https://api.audius.co/v1';
const APP_NAME = 'fitflow';

/** This month's trending chart for one genre: up to 100 tracks. */
export async function fetchTrendingTracks(genre, fetcher = fetch) {
  const url = `${API_URL}/tracks/trending?genre=${encodeURIComponent(genre)}&time=month&limit=100&app_name=${APP_NAME}`;
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Audius answered with status ${response.status}`);
  }
  const { data } = await response.json();
  return data.filter(canStream).map(simplify);
}

/** Some tracks are reserved for an artist's supporters; those cannot play here. */
function canStream(track) {
  return track.is_streamable !== false && !track.is_stream_gated;
}

/** Keeps only what the player shows. */
function simplify(track) {
  return {
    id: track.id,
    title: track.title,
    artist: track.user.name,
    artwork: track.artwork?.['150x150'] ?? '',
    link: `https://audius.co${track.permalink}`,
    streamUrl: `${API_URL}/tracks/${track.id}/stream?app_name=${APP_NAME}`,
  };
}
