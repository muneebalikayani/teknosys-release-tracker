// Enterprise-grade Toast Notification Service
export function showToast(optionsOrMessage, legacyType = 'success', legacyDuration = 4500) {
  let opts = {};
  if (typeof optionsOrMessage === 'string') {
    opts = {
      message: optionsOrMessage,
      type: legacyType,
      duration: legacyDuration
    };
  } else {
    opts = { ...optionsOrMessage };
  }

  const {
    title = '',
    message = '',
    type = 'success',
    duration = 4500,
    action = null
  } = opts;

  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  // Strip leading warning emoji if passed in raw text to avoid double-icons
  const cleanMessage = String(message).replace(/^[⚠️✅❌ℹ️\s]+/, '');

  // Default titles if not supplied
  let displayTitle = title;
  if (!displayTitle) {
    if (type === 'warning') displayTitle = 'GOVERNANCE ALERT';
    else if (type === 'error') displayTitle = 'SYSTEM ERROR';
    else if (type === 'success') displayTitle = 'ACTION COMPLETED';
    else displayTitle = 'NOTIFICATION';
  }

  const icons = {
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast-card toast-${type}`;
  toast.innerHTML = `
    <div class="toast-inner">
      <div class="toast-icon-box toast-icon-${type}">
        ${icons[type] || icons.info}
      </div>
      <div class="toast-content">
        <div class="toast-eyebrow toast-eyebrow-${type}">${displayTitle}</div>
        <div class="toast-text">${cleanMessage}</div>
        ${action && action.label ? `
          <div class="toast-action-row">
            <button type="button" class="toast-action-btn toast-action-${type}">
              ${action.label} ➜
            </button>
          </div>
        ` : ''}
      </div>
      <button class="toast-dismiss-btn" type="button" aria-label="Dismiss">&times;</button>
    </div>
    <div class="toast-progress-track">
      <div class="toast-progress-fill toast-fill-${type}"></div>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
    const fill = toast.querySelector('.toast-progress-fill');
    if (fill) {
      fill.style.transition = `width ${duration}ms linear`;
      requestAnimationFrame(() => {
        fill.style.width = '0%';
      });
    }
  });

  let dismissTimer = null;
  const startTimer = () => {
    dismissTimer = setTimeout(removeToast, duration);
  };

  const removeToast = () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    toast.classList.remove('toast-visible');
    setTimeout(() => {
      toast.remove();
    }, 280);
  };

  startTimer();

  // Action button click
  if (action && typeof action.onClick === 'function') {
    const actionBtn = toast.querySelector('.toast-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeToast();
        action.onClick();
      });
    }
  }

  // Dismiss button
  toast.querySelector('.toast-dismiss-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    removeToast();
  });

  // Pause on hover
  toast.addEventListener('mouseenter', () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    const fill = toast.querySelector('.toast-progress-fill');
    if (fill) {
      fill.style.transition = 'none';
    }
  });
  toast.addEventListener('mouseleave', () => {
    dismissTimer = setTimeout(removeToast, 2000);
  });
}
