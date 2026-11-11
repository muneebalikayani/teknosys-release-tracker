const CHEVRON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
const CHECK_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

let activeDropdown = null;
let bodyObserver = null;
let instanceCounter = 0;

function toSlug(val) {
  return String(val || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function getSemanticDotClass(value) {
  const slug = toSlug(value);
  if (slug === 'completed' || slug === 'production') return 'dot-emerald';
  if (slug === 'on-track' || slug === 'development' || slug === 'sit' || slug === 'uat') return 'dot-blue';
  if (slug === 'at-risk' || slug === 'cab' || slug === 'cab---rfc' || slug === 'cab-approval' || slug === 'pre-prod') return 'dot-orange';
  if (slug === 'delayed' || slug === 'code-freeze') return 'dot-red';
  return 'dot-slate';
}

function getVariantMeta(select) {
  const cls = select.classList;
  const isInlineStage = cls.contains('inline-stage-select');
  const isInlineStatus = cls.contains('inline-status-select');
  return {
    isFilter: cls.contains('filter-select'),
    isControl: cls.contains('control-select'),
    isForm: cls.contains('form-select'),
    isInline: isInlineStage || isInlineStatus,
    isInlineStage,
    isInlineStatus,
    isSemibold: cls.contains('font-semibold')
  };
}

function getAssociatedLabelText(select) {
  const aria = select.getAttribute('aria-label');
  if (aria) return aria;
  const parentFilter = select.closest('.filter-item, .form-group');
  const lbl = parentFilter?.querySelector('label');
  return lbl ? lbl.textContent.replace('*', '').trim() : '';
}

function stripPrefixedClasses(el, prefix) {
  Array.from(el.classList).forEach(cls => {
    if (cls.startsWith(prefix)) el.classList.remove(cls);
  });
}

function syncTriggerDisplay(instance) {
  const { select, trigger, valueEl, meta } = instance;
  const options = Array.from(select.options || []);
  const selectedOpt = options.find(opt => opt.value === select.value) || options[select.selectedIndex] || options[0];

  valueEl.textContent = selectedOpt ? selectedOpt.textContent : '';
  trigger.disabled = Boolean(select.disabled);

  if (meta.isFilter || meta.isControl) {
    const hasAllOption = options.some(opt => opt.value === 'ALL');
    const isActiveFilter = hasAllOption && Boolean(select.value) && select.value !== 'ALL';
    trigger.classList.toggle('has-active-filter', isActiveFilter);
  }

  if (meta.isInlineStage) {
    stripPrefixedClasses(trigger, 'stage-');
    if (select.value) {
      trigger.classList.add(`stage-${toSlug(select.value)}`);
    }
  }

  if (meta.isInlineStatus) {
    stripPrefixedClasses(trigger, 'status-');
    if (select.value) {
      trigger.classList.add(`status-${toSlug(select.value)}`);
    }
  }
}

function patchSelectValueSync(select, onSync) {
  const proto = typeof HTMLSelectElement !== 'undefined' ? HTMLSelectElement.prototype : null;
  if (!proto) return;

  const valDesc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (valDesc && valDesc.get && valDesc.set) {
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() {
        return valDesc.get.call(this);
      },
      set(next) {
        valDesc.set.call(this, next);
        onSync();
      }
    });
  }

  const idxDesc = Object.getOwnPropertyDescriptor(proto, 'selectedIndex');
  if (idxDesc && idxDesc.get && idxDesc.set) {
    Object.defineProperty(select, 'selectedIndex', {
      configurable: true,
      get() {
        return idxDesc.get.call(this);
      },
      set(next) {
        idxDesc.set.call(this, next);
        onSync();
      }
    });
  }
}

function positionMenu(instance, menu) {
  const { trigger, meta } = instance;
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;
  const gap = 4;

  const minWidth = meta.isInline ? Math.max(rect.width, 156) : rect.width;
  menu.style.minWidth = `${Math.round(minWidth)}px`;
  menu.style.maxWidth = `${Math.max(220, vw - margin * 2)}px`;
  menu.style.maxHeight = '260px';

  // Measure natural menu dimensions offscreen cleanly before clamping
  const menuRect = menu.getBoundingClientRect();
  const menuWidth = Math.max(minWidth, menuRect.width);
  const menuHeight = Math.min(260, menu.scrollHeight + 10);

  let left = rect.left;
  if (left + menuWidth > vw - margin) {
    left = Math.max(margin, rect.right - menuWidth);
  }
  if (left < margin) {
    left = margin;
  }

  const spaceBelow = vh - rect.bottom - margin - gap;
  const spaceAbove = rect.top - margin - gap;
  const openUpward = spaceBelow < Math.min(menuHeight, 180) && spaceAbove > spaceBelow;

  if (openUpward) {
    const clampedHeight = Math.min(menuHeight, Math.max(120, spaceAbove));
    menu.style.maxHeight = `${Math.floor(clampedHeight)}px`;
    menu.style.top = 'auto';
    menu.style.bottom = `${Math.round(vh - rect.top + gap)}px`;
    menu.dataset.placement = 'top';
  } else {
    const clampedHeight = Math.min(260, Math.max(120, spaceBelow));
    menu.style.maxHeight = `${Math.floor(clampedHeight)}px`;
    menu.style.bottom = 'auto';
    menu.style.top = `${Math.round(rect.bottom + gap)}px`;
    menu.dataset.placement = 'bottom';
  }

  menu.style.left = `${Math.round(left)}px`;
}

export function closeActiveCustomSelect({ restoreFocus = false } = {}) {
  if (!activeDropdown) return;
  const { trigger, wrap, menu, cleanup } = activeDropdown;
  activeDropdown = null;

  cleanup();
  wrap.classList.remove('is-open');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.classList.remove('is-open');

  if (menu && menu.parentNode) {
    menu.parentNode.removeChild(menu);
  }

  if (restoreFocus && document.contains(trigger)) {
    trigger.focus();
  }
}

function selectOptionValue(instance, value) {
  const { select } = instance;
  const prev = select.value;
  if (prev !== value) {
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  syncTriggerDisplay(instance);
  closeActiveCustomSelect({ restoreFocus: true });
}

function openCustomSelectMenu(instance) {
  if (instance.select.disabled || !document.body) return;

  if (activeDropdown && activeDropdown.instance === instance) {
    closeActiveCustomSelect();
    return;
  }

  closeActiveCustomSelect();

  const { select, wrap, trigger, meta, listboxId } = instance;
  const options = Array.from(select.options || []);
  if (options.length === 0) return;

  const menu = document.createElement('div');
  menu.id = listboxId;
  menu.className = 'custom-select-menu';
  menu.setAttribute('role', 'listbox');
  if (meta.isFilter) menu.classList.add('is-compact');
  if (meta.isInline) menu.classList.add('is-compact', 'is-inline-menu');
  if (meta.isForm) menu.classList.add('is-form-menu');

  const optionEls = options.map((opt, idx) => {
    const isSelected = opt.value === select.value;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'custom-select-option';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    item.dataset.value = opt.value;
    item.dataset.index = String(idx);
    if (opt.disabled) {
      item.disabled = true;
      item.classList.add('is-disabled');
    }
    if (isSelected) {
      item.classList.add('is-selected', 'is-highlighted');
    }

    const leftSpan = document.createElement('span');
    leftSpan.className = 'custom-select-option-main';

    if (meta.isInline) {
      const dot = document.createElement('span');
      dot.className = `custom-option-dot ${getSemanticDotClass(opt.value)}`;
      dot.setAttribute('aria-hidden', 'true');
      leftSpan.appendChild(dot);
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'custom-select-option-label';
    textSpan.textContent = opt.textContent;
    leftSpan.appendChild(textSpan);

    const checkSpan = document.createElement('span');
    checkSpan.className = 'custom-select-check';
    checkSpan.setAttribute('aria-hidden', 'true');
    checkSpan.innerHTML = isSelected ? CHECK_SVG : '';

    item.appendChild(leftSpan);
    item.appendChild(checkSpan);

    item.addEventListener('mouseenter', () => {
      if (opt.disabled) return;
      setHighlighted(idx);
    });

    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (opt.disabled) return;
      selectOptionValue(instance, opt.value);
    });

    menu.appendChild(item);
    return item;
  });

  document.body.appendChild(menu);
  positionMenu(instance, menu);

  wrap.classList.add('is-open');
  trigger.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');

  let highlightedIdx = Math.max(0, options.findIndex(opt => opt.value === select.value && !opt.disabled));
  if (optionEls[highlightedIdx]) {
    optionEls[highlightedIdx].classList.add('is-highlighted');
    requestAnimationFrame(() => {
      optionEls[highlightedIdx]?.scrollIntoView({ block: 'nearest' });
    });
  }

  let typeBuffer = '';
  let typeTimer = null;

  function setHighlighted(nextIdx) {
    if (nextIdx < 0 || nextIdx >= optionEls.length) return;
    optionEls.forEach(el => el.classList.remove('is-highlighted'));
    highlightedIdx = nextIdx;
    const targetEl = optionEls[highlightedIdx];
    if (targetEl) {
      targetEl.classList.add('is-highlighted');
      targetEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function stepHighlight(delta) {
    let idx = highlightedIdx;
    for (let i = 0; i < options.length; i += 1) {
      idx = (idx + delta + options.length) % options.length;
      if (!options[idx].disabled) {
        setHighlighted(idx);
        return;
      }
    }
  }

  const onPointerDown = (e) => {
    if (menu.contains(e.target) || trigger.contains(e.target)) return;
    closeActiveCustomSelect();
  };

  const onKeyDown = (e) => {
    if (!activeDropdown) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeActiveCustomSelect({ restoreFocus: true });
      return;
    }
    if (e.key === 'Tab') {
      closeActiveCustomSelect();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      stepHighlight(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      stepHighlight(-1);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      const first = options.findIndex(o => !o.disabled);
      if (first >= 0) setHighlighted(first);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      for (let i = options.length - 1; i >= 0; i -= 1) {
        if (!options[i].disabled) {
          setHighlighted(i);
          break;
        }
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const chosen = options[highlightedIdx];
      if (chosen && !chosen.disabled) {
        selectOptionValue(instance, chosen.value);
      }
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.stopPropagation();
      typeBuffer += e.key.toLowerCase();
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => {
        typeBuffer = '';
      }, 650);
      const matchIdx = options.findIndex(
        o => !o.disabled && o.textContent.trim().toLowerCase().startsWith(typeBuffer)
      );
      if (matchIdx >= 0) {
        setHighlighted(matchIdx);
      }
    }
  };

  let repositionRaf = null;
  const onViewportChange = (e) => {
    if (e?.target && menu.contains(e.target)) return;
    if (!document.contains(select) || !document.contains(trigger)) {
      closeActiveCustomSelect();
      return;
    }
    const rect = trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      closeActiveCustomSelect();
      return;
    }
    cancelAnimationFrame(repositionRaf);
    repositionRaf = requestAnimationFrame(() => {
      if (activeDropdown && activeDropdown.menu === menu) {
        positionMenu(instance, menu);
      }
    });
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', onViewportChange, true);

  activeDropdown = {
    instance,
    select,
    wrap,
    trigger,
    menu,
    cleanup: () => {
      clearTimeout(typeTimer);
      cancelAnimationFrame(repositionRaf);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    }
  };
}

/** Upgrade a native <select> element into a theme-matched custom dropdown. */
export function upgradeSelect(select) {
  if (typeof document === 'undefined' || !select || select.nodeType !== 1) return null;
  if (select.dataset.customSelectUpgraded === '1' || select.dataset.nativeSelect === 'true') {
    return select._customSelectInstance || null;
  }
  if (!select.parentNode) return null;

  const meta = getVariantMeta(select);
  const uid = ++instanceCounter;
  const listboxId = `custom-select-listbox-${uid}`;

  const wrap = document.createElement('div');
  wrap.className = 'custom-select-wrap';
  if (meta.isFilter) wrap.classList.add('is-filter-select');
  if (meta.isControl) wrap.classList.add('is-control-select');
  if (meta.isForm) wrap.classList.add('is-form-select');
  if (meta.isInline) wrap.classList.add('is-inline-select');
  if (meta.isInlineStage) wrap.classList.add('is-inline-stage');
  if (meta.isInlineStatus) wrap.classList.add('is-inline-status');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  if (meta.isFilter) trigger.classList.add('is-filter-select');
  if (meta.isControl) trigger.classList.add('is-control-select');
  if (meta.isForm) trigger.classList.add('is-form-select');
  if (meta.isInlineStage) trigger.classList.add('is-inline-stage');
  if (meta.isInlineStatus) trigger.classList.add('is-inline-status');
  if (meta.isSemibold) trigger.classList.add('font-semibold');

  const labelText = getAssociatedLabelText(select);
  if (labelText) trigger.setAttribute('aria-label', labelText);
  if (select.title) trigger.title = select.title;

  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', listboxId);

  const valueEl = document.createElement('span');
  valueEl.className = 'custom-select-value';

  const arrowEl = document.createElement('span');
  arrowEl.className = 'custom-select-arrow';
  arrowEl.setAttribute('aria-hidden', 'true');
  arrowEl.innerHTML = CHEVRON_SVG;

  trigger.appendChild(valueEl);
  trigger.appendChild(arrowEl);

  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  wrap.appendChild(trigger);

  select.dataset.customSelectUpgraded = '1';
  select.classList.add('custom-select-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const instance = { select, wrap, trigger, valueEl, arrowEl, meta, listboxId };
  select._customSelectInstance = instance;

  const sync = () => syncTriggerDisplay(instance);
  patchSelectValueSync(select, sync);
  select.addEventListener('change', sync);
  select.addEventListener('focus', () => {
    if (document.contains(trigger) && document.activeElement !== trigger) {
      trigger.focus();
    }
  });

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCustomSelectMenu(instance);
  });

  trigger.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      openCustomSelectMenu(instance);
    }
  });

  sync();
  return instance;
}

/** Upgrade all un-enhanced <select> elements inside the given DOM root. */
export function upgradeAllSelects(root = typeof document !== 'undefined' ? document : null) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  if (activeDropdown && !document.contains(activeDropdown.select)) {
    closeActiveCustomSelect();
  }
  root.querySelectorAll('select:not([data-custom-select-upgraded="1"]):not([data-native-select="true"])').forEach(sel => {
    upgradeSelect(sel);
  });
}

/** Observe dynamic DOM insertions (modals, partial table renders) and upgrade <select> controls automatically. */
export function observeCustomSelects(root = typeof document !== 'undefined' ? document.body : null) {
  if (typeof MutationObserver === 'undefined' || !root || bodyObserver) return;

  upgradeAllSelects(root);

  bodyObserver = new MutationObserver((mutations) => {
    if (activeDropdown && !document.contains(activeDropdown.select)) {
      closeActiveCustomSelect();
    }

    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList?.contains('custom-select-menu')) continue;
        if (node.tagName === 'SELECT') {
          upgradeSelect(node);
        } else if (node.querySelectorAll) {
          upgradeAllSelects(node);
        }
      }
    }
  });

  bodyObserver.observe(root, { childList: true, subtree: true });
}
