// Toast Notification Service
export function showToast(message, type = 'success', duration = 4000) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.innerHTML = `
    <div class="toast-body">${message}</div>
    <button class="toast-close" type="button" aria-label="Close notification">&times;</button>
  `;

  toastContainer.appendChild(toast);

  // Trigger smooth enter transition
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  const removeToast = () => {
    toast.classList.remove('toast-visible');
    setTimeout(() => {
      toast.remove();
    }, 250);
  };

  toast.querySelector('.toast-close').addEventListener('click', removeToast);
  setTimeout(removeToast, duration);
}
