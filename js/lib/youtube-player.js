let apiPromise;

/** Load the public IFrame Player API only after a person requests a demo. */
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onerror = null;
      if (error) { script.remove(); apiPromise = undefined; reject(error); }
      else resolve(window.YT);
    };
    const timer = setTimeout(() => finish(new Error('The video service did not respond.')), 10000);
    window.onYouTubeIframeAPIReady = () => finish();
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => finish(new Error('The video service could not be reached.'));
    document.head.append(script);
  });
  return apiPromise;
}

/** Returns cleanup immediately, including while the remote API is still loading. */
export function mountVideo(container, { videoId, title, onReady, onError }) {
  let disposed = false;
  let player;
  let timer;
  const fail = () => {
    if (disposed) return;
    clearTimeout(timer);
    onError('This video could not load here. Try again or open it on YouTube.');
  };
  loadYouTubeApi().then(YT => {
    if (disposed) return;
    const target = document.createElement('div');
    container.replaceChildren(target);
    timer = setTimeout(fail, 12000);
    player = new YT.Player(target, {
      host: 'https://www.youtube-nocookie.com',
      videoId,
      width: '100%', height: '100%',
      playerVars: { origin: window.location.origin, playsinline: 1, rel: 0, cc_load_policy: 1, autoplay: 0 },
      events: {
        onReady(event) {
          if (disposed) return;
          clearTimeout(timer);
          event.target.getIframe().title = `${title} — video demonstration`;
          onReady();
        },
        onError: fail,
      },
    });
    const iframe = player.getIframe();
    iframe.title = `${title} — video demonstration`;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  }).catch(fail);
  return () => {
    disposed = true;
    clearTimeout(timer);
    player?.destroy();
    container.replaceChildren();
  };
}
