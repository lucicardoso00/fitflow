/**
 * Music player — random tracks from Audius while you train. The markup lives
 * in the page; this fills it in and wires up the buttons.
 *
 *   createMusicPlayer(document.getElementById('music-player'));
 *
 * Pick a genre and press Play: a random track from that genre's trending
 * chart starts, and when it ends another random one follows. Next skips.
 */

import { MUSIC_GENRES } from '../data/music.js';
import { fetchTrendingTracks } from '../lib/audius.js';
import { loadMusicGenre, saveMusicGenre } from '../lib/storage.js';

export function createMusicPlayer(root) {
  const audio = root.querySelector('.music-player__audio');
  const artwork = root.querySelector('.music-player__artwork');
  const title = root.querySelector('.music-player__title');
  const link = root.querySelector('.music-player__link');
  const status = root.querySelector('.music-player__status');
  const genreSelect = root.querySelector('.music-player__genre');
  const playButton = root.querySelector('.music-player__play');
  const nextButton = root.querySelector('.music-player__next');

  let tracks = [];  // the chosen genre's chart
  let track = null; // the track in the player right now

  // ---------- Actions ----------

  async function loadChart() {
    tracks = [];
    showStatus('Loading music…');
    try {
      tracks = await fetchTrendingTracks(genreSelect.value);
      showStatus(`${tracks.length} tracks ready · press Play`);
    } catch {
      showStatus('Music is unavailable right now.');
    }
    drawButtons();
  }

  /** A random track from the chart, never the one that just played. */
  function pickRandomTrack() {
    const candidates = tracks.length > 1 ? tracks.filter((candidate) => candidate !== track) : tracks;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Puts a random track in the player without starting it. */
  function loadRandomTrack() {
    track = pickRandomTrack();
    audio.src = track.streamUrl;
    drawTrack();
  }

  async function playRandomTrack() {
    if (tracks.length === 0) {
      return; // the status line says why
    }
    loadRandomTrack();
    try {
      await audio.play();
    } catch {
      showStatus('Press Play to start the music.');
    }
  }

  async function togglePlay() {
    if (tracks.length === 0) {
      await loadChart(); // a retry, if the chart could not load before
    }
    if (track === null) {
      playRandomTrack();
    } else if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }

  /** Switches to the new genre and keeps the player playing or paused, as it was. */
  async function changeGenre() {
    saveMusicGenre(genreSelect.value);
    const wasPlaying = !audio.paused;
    await loadChart();
    if (track !== null && tracks.length > 0) {
      loadRandomTrack();
      if (wasPlaying) {
        audio.play();
      }
    }
  }

  // ---------- Drawing ----------

  function drawButtons() {
    const isPlaying = !audio.paused;
    root.classList.toggle('is-playing', isPlaying);
    playButton.textContent = isPlaying ? 'Pause' : 'Play';
    nextButton.disabled = tracks.length === 0;
  }

  function drawTrack() {
    title.textContent = track.title;
    artwork.src = track.artwork;
    artwork.hidden = track.artwork === '';
    link.href = track.link;
    link.textContent = `${track.artist} · on Audius ↗`;
    link.hidden = false;
    status.hidden = true;
  }

  /** The second line shows either the artist link or a short message. */
  function showStatus(message) {
    status.textContent = message;
    status.hidden = false;
    link.hidden = true;
  }

  // ---------- Events ----------

  playButton.addEventListener('click', togglePlay);
  nextButton.addEventListener('click', playRandomTrack);
  genreSelect.addEventListener('change', changeGenre);
  audio.addEventListener('play', drawButtons);
  audio.addEventListener('pause', drawButtons);
  audio.addEventListener('ended', playRandomTrack);
  audio.addEventListener('error', () => showStatus('This track could not play. Try Next.'));

  // ---------- Start ----------

  // new Option('Pop') is a ready-made <option>Pop</option>
  genreSelect.replaceChildren(...MUSIC_GENRES.map((genre) => new Option(genre)));
  const savedGenre = loadMusicGenre();
  if (MUSIC_GENRES.includes(savedGenre)) {
    genreSelect.value = savedGenre;
  }
  loadChart();
}
