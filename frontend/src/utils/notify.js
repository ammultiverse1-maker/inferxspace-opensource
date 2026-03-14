export function notify(type, message) {
  try {
    window.dispatchEvent(new CustomEvent('app-notify', { detail: { type, message } }));
  } catch (e) {
    // Fallback to console if CustomEvent isn't available
    console[type === 'error' ? 'error' : 'log'](message);
  }
}

export default notify;
