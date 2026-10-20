/**
 * Rest timer — counts down and empties the ring.
 *
 *   const restTimer = createRestTimer(document.getElementById('rest-timer'), onFinish);
 *   restTimer.start(45);   restTimer.addTime(15);   restTimer.stop();
 *
 * It compares against the clock (Date.now) instead of counting ticks,
 * so the time stays right even if the browser slows the page down.
 */

import { formatClock } from '../lib/format.js';

export function createRestTimer(element, onFinish) {
  const ring = element.querySelector('.rest-timer__progress');
  const timeText = element.querySelector('.rest-timer__time');

  let endsAt = 0;       // when the rest is over, in milliseconds
  let totalSeconds = 0; // the length of a full ring
  let intervalId = null;

  function getSecondsLeft() {
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  }

  function draw() {
    const secondsLeft = getSecondsLeft();
    const fractionLeft = secondsLeft / totalSeconds;

    timeText.textContent = formatClock(secondsLeft);
    ring.style.strokeDashoffset = String(100 - fractionLeft * 100); // 0 = full ring, 100 = empty
    element.setAttribute('aria-label', `${secondsLeft} seconds of rest left`);
  }

  function tick() {
    draw();
    if (getSecondsLeft() === 0) {
      stop();
      onFinish();
    }
  }

  function start(seconds) {
    stop();
    totalSeconds = seconds;
    endsAt = Date.now() + seconds * 1000;
    draw();
    intervalId = setInterval(tick, 250);
  }

  function addTime(seconds) {
    endsAt += seconds * 1000;
    totalSeconds = Math.max(totalSeconds, getSecondsLeft()); // never draw more than a full ring
    draw();
  }

  function stop() {
    clearInterval(intervalId);
    intervalId = null;
  }

  return { start, addTime, stop };
}
