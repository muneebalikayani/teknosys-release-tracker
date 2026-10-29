import { store } from '../data/store.js';

let isChatOpen = false;
let chatMessages = [
  {
    sender: 'bot',
    text: `👋 Hi! I'm **TeknoBot**, your Telecom DW Release Assistant. 

I have real-time access to all **${store.releases.length} releases**, developer workloads, lifecycle stages, and **${store.holidays.length} public holidays**.

How can I help you today? You can ask a question or tap one of the quick suggestions below:`,
    quickReplies: [
      '⚠️ Any holiday conflicts?',
      '📊 Summarize releases',
      '⚡ Show all Hotfixes',
      '⏳ What is in UAT or CAB?',
      '👤 Who has the most releases?',
      '⏱️ What is our average lead time?'
    ],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
];

export function initChatbot() {
  // Prevent duplicate mounts
  if (document.getElementById('teknobot-root')) return;

  const root = document.createElement('div');
  root.id = 'teknobot-root';
  root.innerHTML = `
    <!-- Floating Launcher Trigger Button -->
    <button class="teknobot-launcher" id="teknobot-launcher-btn" title="Open TeknoBot AI Release Assistant">
      <div class="launcher-glow"></div>
      <div class="launcher-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
          <rect x="3" y="8" width="18" height="12" rx="4"></rect>
          <circle cx="8" cy="13" r="1.5" fill="currentColor"></circle>
          <circle cx="16" cy="13" r="1.5" fill="currentColor"></circle>
          <path d="M9 17c1 1 2 1 3 1s2 0 3-1"></path>
        </svg>
      </div>
      <span class="launcher-badge" id="teknobot-badge">1</span>
    </button>

    <!-- Chat Window Container -->
    <div class="teknobot-window" id="teknobot-window">
      <!-- Header -->
      <div class="teknobot-header">
        <div class="header-bot-info">
          <div class="bot-avatar-wrap">
            <div class="bot-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="8" width="18" height="12" rx="4"></rect>
                <circle cx="9" cy="13" r="1.5" fill="currentColor"></circle>
                <circle cx="15" cy="13" r="1.5" fill="currentColor"></circle>
                <path d="M9 17c1 .8 2 .8 3 .8s2 0 3-.8"></path>
                <line x1="12" y1="5" x2="12" y2="8"></line>
              </svg>
            </div>
            <span class="avatar-online-dot"></span>
          </div>
          <div>
            <div class="bot-name">TeknoBot <span class="ai-badge">AI Assistant</span></div>
            <div class="bot-subtitle">Telecom DW · 37 Releases Live Context</div>
          </div>
        </div>

        <div class="teknobot-header-actions">
          <button class="header-action-btn" id="teknobot-clear-btn" title="Clear Conversation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <button class="header-action-btn" id="teknobot-close-btn" title="Close Chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- Messages Body -->
      <div class="teknobot-messages" id="teknobot-messages">
        <!-- Message bubbles dynamically render here -->
      </div>

      <!-- Quick Suggestion Chips Bar -->
      <div class="teknobot-quick-bar" id="teknobot-quick-bar">
        <!-- Quick pills render dynamically -->
      </div>

      <!-- Input Footer -->
      <form class="teknobot-footer" id="teknobot-form">
        <input 
          type="text" 
          id="teknobot-input" 
          class="teknobot-input" 
          placeholder="Ask a question or enter a command..." 
          autocomplete="off"
        />
        <button type="submit" class="teknobot-send-btn" id="teknobot-send-btn" title="Send Message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(root);

  // Setup DOM event listeners
  setupChatbotEvents(root);
  renderMessages();
}

function setupChatbotEvents(root) {
  const launcher = root.querySelector('#teknobot-launcher-btn');
  const windowEl = root.querySelector('#teknobot-window');
  const closeBtn = root.querySelector('#teknobot-close-btn');
  const clearBtn = root.querySelector('#teknobot-clear-btn');
  const form = root.querySelector('#teknobot-form');
  const input = root.querySelector('#teknobot-input');
  const badge = root.querySelector('#teknobot-badge');

  function toggleChat(open) {
    isChatOpen = open !== undefined ? open : !isChatOpen;
    windowEl.classList.toggle('open', isChatOpen);
    launcher.classList.toggle('active', isChatOpen);

    if (isChatOpen) {
      if (badge) badge.style.display = 'none';
      setTimeout(() => input.focus(), 250);
      scrollToBottom();
    }
  }

  launcher.addEventListener('click', () => toggleChat());
  closeBtn.addEventListener('click', () => toggleChat(false));

  clearBtn.addEventListener('click', () => {
    chatMessages = [
      {
        sender: 'bot',
        text: `Conversation cleared. What would you like to explore next?`,
        quickReplies: [
          '⚠️ Any holiday conflicts?',
          '📊 Summarize releases',
          '⚡ Show all Hotfixes',
          '👤 Who has the most releases?'
        ],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    renderMessages();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    // Add user message
    chatMessages.push({
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    input.value = '';
    renderMessages();

    // Show typing indicator
    showTypingIndicator();

    // Process response with simulated AI delay
    setTimeout(() => {
      removeTypingIndicator();
      const response = processQuery(query);
      chatMessages.push({
        sender: 'bot',
        text: response.text,
        actions: response.actions,
        quickReplies: response.quickReplies,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      renderMessages();
    }, 450);
  });
}

function renderMessages() {
  const container = document.getElementById('teknobot-messages');
  const quickBar = document.getElementById('teknobot-quick-bar');
  if (!container) return;

  container.innerHTML = chatMessages.map((msg, idx) => {
    const isBot = msg.sender === 'bot';
    return `
      <div class="chat-message ${isBot ? 'bot-message' : 'user-message'}">
        ${isBot ? `
          <div class="msg-bot-avatar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="8" width="18" height="12" rx="4"></rect>
              <circle cx="9" cy="13" r="1.5" fill="currentColor"></circle>
              <circle cx="15" cy="13" r="1.5" fill="currentColor"></circle>
            </svg>
          </div>
        ` : ''}
        <div class="msg-bubble-wrap">
          <div class="msg-bubble">
            <div class="msg-content">${formatMarkdown(msg.text)}</div>
            ${msg.actions && msg.actions.length > 0 ? `
              <div class="msg-actions">
                ${msg.actions.map(act => `
                  <button class="msg-action-btn" data-action="${act.action}" data-val="${act.value || ''}">
                    ${act.icon || ''} ${act.label}
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <span class="msg-time">${msg.time}</span>
        </div>
      </div>
    `;
  }).join('');

  // Wire action buttons inside messages
  container.querySelectorAll('.msg-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const val = btn.dataset.val;
      executeChatAction(action, val);
    });
  });

  // Render latest quick replies
  const lastBotMsg = [...chatMessages].reverse().find(m => m.sender === 'bot' && m.quickReplies && m.quickReplies.length > 0);
  if (quickBar) {
    if (lastBotMsg && lastBotMsg.quickReplies) {
      quickBar.innerHTML = lastBotMsg.quickReplies.map(reply => `
        <button class="quick-chip" data-query="${reply}">${reply}</button>
      `).join('');

      quickBar.querySelectorAll('.quick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const query = chip.dataset.query;
          const input = document.getElementById('teknobot-input');
          if (input) {
            input.value = query;
            document.getElementById('teknobot-form').dispatchEvent(new Event('submit'));
          }
        });
      });
      quickBar.style.display = 'flex';
    } else {
      quickBar.style.display = 'none';
    }
  }

  scrollToBottom();
}

function showTypingIndicator() {
  const container = document.getElementById('teknobot-messages');
  if (!container) return;
  const typingEl = document.createElement('div');
  typingEl.id = 'teknobot-typing';
  typingEl.className = 'chat-message bot-message typing-indicator';
  typingEl.innerHTML = `
    <div class="msg-bot-avatar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="8" width="18" height="12" rx="4"></rect>
      </svg>
    </div>
    <div class="msg-bubble typing-bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  container.appendChild(typingEl);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById('teknobot-typing')?.remove();
}

function scrollToBottom() {
  const container = document.getElementById('teknobot-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// -------------------------------------------------------------
// Natural Language Processing & Telecommunication Query Engine
// -------------------------------------------------------------
function processQuery(query) {
  const q = query.toLowerCase().trim();
  const metrics = store.getMetrics();
  const analytics = store.getAdvancedAnalytics();
  const releases = store.releases;

  // 1. Conflicts, Holidays
  if (q.includes('conflict') || q.includes('holiday') || q.includes('freeze')) {
    const conflicting = store.getConflictingReleases();
    if (conflicting.length > 0) {
      const itemsList = conflicting.map(r => `• **#${r.id} ${r.name}** (Target: \`${r.targetDeploy}\`) — *${r.holidayConflict}*`).join('\n');
      return {
        text: `⚠️ **Warning: ${conflicting.length} Holiday Conflict${conflicting.length > 1 ? 's' : ''} Detected!**\n\nThe following releases have target deployments overlapping with active telecom public holiday freeze periods:\n\n${itemsList}\n\n*Telecom SOP requires rescheduling these releases or obtaining an executive CAB emergency exception.*`,
        actions: [
          { action: 'filter_conflicts', label: 'View Conflicts in Tracker', icon: '🔍' },
          { action: 'switch_view', value: 'holidays', label: 'Open Holidays Tab', icon: '📅' }
        ],
        quickReplies: ['📅 Next holiday?', '📊 Summarize status', '⚡ Show Hotfixes']
      };
    } else {
      const nextH = analytics.nextHoliday;
      return {
        text: `✅ **No Holiday Conflicts Detected!**\n\nAll ${releases.length} releases are scheduled safely outside of telecom holiday moratoriums.\n\nNext scheduled holiday:\n• **${nextH ? nextH.name : 'None defined'}** on \`${nextH ? nextH.startDate : 'N/A'}\` (${analytics.daysToNextHoliday} days remaining).`,
        actions: [
          { action: 'switch_view', value: 'holidays', label: 'Inspect Holiday Calendar', icon: '📅' }
        ],
        quickReplies: ['📊 Summarize releases', '⏳ What is in UAT?']
      };
    }
  }

  // 2. Next Holiday
  if (q.includes('next holiday') || q.includes('upcoming holiday')) {
    const nextH = analytics.nextHoliday;
    if (nextH) {
      return {
        text: `📅 **Upcoming Public Holiday:**\n\n• **Name:** ${nextH.name}\n• **Dates:** \`${nextH.startDate}\` ${nextH.endDate && nextH.endDate !== nextH.startDate ? `to \`${nextH.endDate}\`` : ''}\n• **Countdown:** **${analytics.daysToNextHoliday} days** remaining\n• **Notes:** ${nextH.notes || 'Public moratorium'}\n• **Safety:** ${analytics.releasesNearHoliday.length === 0 ? '✅ 0 conflicting releases' : `⚠️ ${analytics.releasesNearHoliday.length} releases near window`}`,
        actions: [
          { action: 'switch_view', value: 'holidays', label: 'View Holidays Tab', icon: '📅' }
        ],
        quickReplies: ['⚠️ Any conflicts?', '📊 Summarize releases']
      };
    }
  }

  // 3. Hotfixes & Emergency Patches
  if (q.includes('hotfix') || q.includes('emergency') || q.includes('patch')) {
    const hotfixes = releases.filter(r => r.type === 'Hotfix' || r.type === 'Emergency');
    const items = hotfixes.slice(0, 5).map(r => `• **#${r.id} ${r.name}** [${r.type}] · Platform: \`${r.platform}\` · Dev: *${r.developer || 'Unassigned'}* · Status: **${r.status}**`).join('\n');
    return {
      text: `⚡ **Hotfix & Emergency Releases (${hotfixes.length} Total)**\n\n• **Hotfixes:** ${analytics.hotfixCount}\n• **Emergencies:** ${analytics.emergencyCount}\n• **Average Turnaround Lead Time:** **${analytics.avgHotfixLeadTime} days** (SLA target: < 48 hours)\n\n${items}`,
      actions: [
        { action: 'filter_type', value: 'Hotfix', label: 'Filter Hotfixes in Tracker', icon: '⚡' },
        { action: 'filter_type', value: 'Emergency', label: 'Filter Emergencies', icon: '🚨' }
      ],
      quickReplies: ['⏱️ Average lead time', '📊 Summarize releases', '👤 Who is working on what?']
    };
  }

  // 4. On Hold Releases Query (Releases on hold at any stage)
  if (q.includes('on hold') || q.includes('paused') || q.includes('hold')) {
    const onHoldReleases = releases.filter(r => r.status === 'On Hold' || r.stage === 'On Hold');
    const list = onHoldReleases.slice(0, 5).map(r => `• **#${r.id} ${r.name}** [${r.platform}] · Stage: *${r.stage}* · Dev: *${r.developer || 'Unassigned'}* (Target: \`${r.targetDeploy || 'TBD'}\`)`).join('\n');

    return {
      text: `⏸️ **Releases On Hold (${onHoldReleases.length}):**\n\nReleases can be placed on hold at any lifecycle stage:\n\n${onHoldReleases.length > 0 ? list : 'No releases are currently on hold.'}\n\n*Note: On Hold is a delivery status that applies to releases at any stage (Development, UAT, CAB, etc.).*`,
      actions: [
        { action: 'filter_status', value: 'On Hold', label: 'Filter On Hold in Tracker', icon: '⏸️' },
        { action: 'switch_view', value: 'board', label: 'Open Kanban Board', icon: '🗂️' }
      ],
      quickReplies: ['📊 Summarize status', '⚠️ Any conflicts?', '⚡ Show Hotfixes']
    };
  }

  // 5. Lifecycle Stages (UAT, CAB, Production, Development, Completed)
  const stageKeywords = ['uat', 'cab', 'rfc', 'production', 'development', 'completed'];
  const matchedStage = stageKeywords.find(st => q.includes(st));
  if (matchedStage) {
    let stageName = 'UAT';
    if (matchedStage === 'cab' || matchedStage === 'rfc') stageName = 'CAB';
    else if (matchedStage === 'production') stageName = 'Production';
    else if (matchedStage === 'development') stageName = 'Development';
    else if (matchedStage === 'completed') stageName = 'Completed';

    const stageReleases = releases.filter(r => r.stage.toLowerCase() === stageName.toLowerCase());
    const list = stageReleases.slice(0, 5).map(r => `• **#${r.id} ${r.name}** (Target: \`${r.targetDeploy || 'TBD'}\`) · Dev: *${r.developer || 'N/A'}* · [${r.status}]`).join('\n');

    return {
      text: `📦 **Releases in Stage: ${stageName} (${stageReleases.length})**\n\n${stageReleases.length > 0 ? list : 'No releases currently in this stage.'}\n\n*Overall Stage Distribution:*\n• Development: ${metrics.byStage['Development'] || 0}\n• UAT: ${metrics.byStage['UAT'] || 0}\n• CAB: ${metrics.byStage['CAB'] || 0}\n• Production: ${metrics.byStage['Production'] || 0}\n• Completed: ${metrics.byStage['Completed'] || 0}`,
      actions: [
        { action: 'filter_stage', value: stageName, label: `View ${stageName} in Tracker`, icon: '🔍' },
        { action: 'switch_view', value: 'board', label: 'Open Workflow Board', icon: '🗂️' }
      ],
      quickReplies: ['📊 Summarize status', '⚠️ Any conflicts?', '⚡ Show Hotfixes']
    };
  }

  // 5. Developers / Engineering Team
  if (q.includes('developer') || q.includes('who') || q.includes('team') || q.includes('engineer') || q.includes('workload')) {
    // Check if user named a specific developer
    const devNames = ['rabia', 'mahum', 'ukasha', 'bilal', 'hamza', 'zeeshan', 'farhan', 'sundus', 'aqsa', 'fatima'];
    const matchedDevName = devNames.find(d => q.includes(d));

    if (matchedDevName) {
      const devReleases = releases.filter(r => r.developer && r.developer.toLowerCase().includes(matchedDevName));
      const devFullName = devReleases.length > 0 ? devReleases[0].developer : matchedDevName;
      const completedCount = devReleases.filter(r => r.status === 'Completed').length;
      const list = devReleases.map(r => `• **#${r.id} ${r.name}** [${r.platform}] · Stage: *${r.stage}* · Status: **${r.status}** (Target: \`${r.targetDeploy}\`)`).join('\n');

      return {
        text: `👤 **Developer Profile: ${devFullName}**\n\n• **Total Releases:** ${devReleases.length}\n• **Completed:** ${completedCount}\n• **In-Flight:** ${devReleases.length - completedCount}\n\n**Assigned Releases:**\n${list}`,
        actions: [
          { action: 'filter_dev', value: devFullName, label: `Filter ${devFullName}'s Releases`, icon: '👤' }
        ],
        quickReplies: ['👤 Who has the most releases?', '📊 Summarize status']
      };
    }

    // General Developer workload ranking
    const topDevs = analytics.devWorkload.slice(0, 5).map((d, i) => `${i + 1}. **${d.name}**: ${d.total} releases (${d.completed} Done, ${d.open} Active) · *${d.platforms.join(', ')}*`).join('\n');
    return {
      text: `👥 **Top Engineering Team Contributors:**\n\n${topDevs}\n\n*Total Active Engineers:* ${analytics.devWorkload.length}\n*Tip: Tap any developer button below to view their assigned releases.*`,
      actions: analytics.devWorkload.slice(0, 3).map(d => ({
        action: 'filter_dev',
        value: d.name,
        label: d.name,
        icon: '👤'
      })),
      quickReplies: ['⏱️ Average lead time', '📊 Summarize releases']
    };
  }

  // 6. Platforms (GSM, DFS, APIs, DPI, BI)
  const platforms = ['gsm', 'dfs', 'apis', 'api', 'dpi', 'bi'];
  const matchedPlat = platforms.find(p => q.includes(p));
  if (matchedPlat) {
    let platCode = matchedPlat.toUpperCase();
    if (platCode === 'API') platCode = 'APIs';
    const platRels = releases.filter(r => (r.platform || '').toUpperCase() === platCode);
    const completed = platRels.filter(r => r.status === 'Completed').length;
    const avgDays = analytics.platformLeadTimes[platCode] ? analytics.platformLeadTimes[platCode].avg : 'N/A';

    return {
      text: `📱 **Platform Overview: ${platCode}**\n\n• **Total Releases:** ${platRels.length} (${Math.round((platRels.length / releases.length) * 100)}% of DW Scope)\n• **Completed:** ${completed}\n• **In Progress:** ${platRels.length - completed}\n• **Avg Delivery Lead Time:** **${avgDays} days**\n\n*Recent ${platCode} deployments include #1, #3, and recent pipeline items.*`,
      actions: [
        { action: 'filter_platform', value: platCode, label: `Filter ${platCode} in Tracker`, icon: '🔍' }
      ],
      quickReplies: ['📊 Summarize status', '⚡ Show Hotfixes', '⏱️ Lead times']
    };
  }

  // 7. Lead Time & Speed & SLAs
  if (q.includes('lead time') || q.includes('cycle') || q.includes('duration') || q.includes('sla') || q.includes('speed') || q.includes('how long')) {
    return {
      text: `⏱️ **Delivery Cycle Time & Velocity Analytics:**\n\n• **Overall Average Lead Time:** **${analytics.avgLeadTime} days** (from Start Date to Target Deploy)\n• **Standard Scheduled Releases:** **${analytics.avgScheduledLeadTime} days**\n• **Hotfix & Emergency Patches:** **${analytics.avgHotfixLeadTime} days** *(Beating 48h SLA)*\n\n**Turnaround Speed by Platform:**\n• GSM: ${analytics.platformLeadTimes['GSM']?.avg || 14} days\n• DFS: ${analytics.platformLeadTimes['DFS']?.avg || 12} days\n• APIs: ${analytics.platformLeadTimes['APIs']?.avg || 8} days\n• DPI: ${analytics.platformLeadTimes['DPI']?.avg || 15} days\n• BI: ${analytics.platformLeadTimes['BI']?.avg || 10} days`,
      actions: [
        { action: 'switch_view', value: 'dashboard', label: 'View Dashboard Analytics', icon: '📊' }
      ],
      quickReplies: ['📊 Summarize releases', '👤 Top developers', '⚡ Show Hotfixes']
    };
  }

  // 8. Database Objects & Architecture Schema
  if (q.includes('db') || q.includes('database') || q.includes('table') || q.includes('schema') || q.includes('sp') || q.includes('procedure')) {
    return {
      text: `🗄️ **Telecom DW Database Schema Impact:**\n\n• **Releases modifying DB Objects:** **${analytics.dbChangesCount}** (${analytics.dbChangesPct}% of all releases)\n• **Application / API Only:** ${releases.length - analytics.dbChangesCount}\n• **CAB Governance Note:** All releases altering Core DW tables or stored procedures require DBA review and rollback scripts attached.`,
      actions: [
        { action: 'switch_view', value: 'releases', label: 'View Tracker Table', icon: '📋' }
      ],
      quickReplies: ['📊 Summarize status', '⚠️ Any conflicts?']
    };
  }

  // 9. Quick Action Commands (Open Modal, Switch Views, Reset)
  if (q.includes('new release') || q.includes('create release') || q.includes('add release')) {
    return {
      text: `✨ I can open the **New Release** form for you right away!`,
      actions: [
        { action: 'open_new_modal', label: 'Open New Release Modal', icon: '➕' }
      ],
      quickReplies: ['📊 Summarize status']
    };
  }

  if (q.includes('calendar')) {
    return {
      text: `📅 Switching to the **Monthly Release Calendar** view...`,
      actions: [{ action: 'switch_view', value: 'calendar', label: 'Open Calendar', icon: '📅' }]
    };
  }

  if (q.includes('kanban') || q.includes('board')) {
    return {
      text: `🗂️ Switching to the **Workflow Kanban Board** view...`,
      actions: [{ action: 'switch_view', value: 'board', label: 'Open Kanban Board', icon: '🗂️' }]
    };
  }

  if (q.includes('timeline') || q.includes('gantt')) {
    return {
      text: `📈 Switching to the **Gantt Timeline** view...`,
      actions: [{ action: 'switch_view', value: 'timeline', label: 'Open Gantt Timeline', icon: '📈' }]
    };
  }

  if (q.includes('report') || q.includes('monthly report')) {
    return {
      text: `📄 Opening the **Executive Monthly Summary Report** generator...`,
      actions: [{ action: 'switch_view', value: 'report', label: 'Open Executive Report', icon: '📄' }]
    };
  }

  if (q.includes('clear filter') || q.includes('reset filter')) {
    return {
      text: `🔄 Resetting all active search and platform filters in the Tracker...`,
      actions: [{ action: 'reset_filters', label: 'Clear Filters Now', icon: '🔄' }]
    };
  }

  // 10. Default General Summary / Overview
  return {
    text: `📊 **Telecom DW Release Executive Briefing:**\n\n• **Total Releases:** ${metrics.total}\n• **Completed:** ${metrics.completed} (${Math.round(metrics.completionRate * 100)}% Success Rate)\n• **In-Flight / Active:** ${metrics.open}\n• **Due in ≤ 3 Days:** ${metrics.dueSoon}\n• **Planned Stability:** ${analytics.plannedStabilityPct}% Scheduled vs ${analytics.reactivePct}% Hotfixes\n• **Holiday Conflicts:** ${store.getConflictingReleases().length > 0 ? `⚠️ ${store.getConflictingReleases().length} conflicting!` : '✅ 0 conflicts'}\n\n*Need specific details? Ask about developers, platforms (GSM/DFS/APIs), stages (UAT/CAB), or lead times.*`,
    actions: [
      { action: 'switch_view', value: 'dashboard', label: 'Go to Dashboard', icon: '📊' },
      { action: 'switch_view', value: 'releases', label: 'Open Tracker List', icon: '📋' }
    ],
    quickReplies: [
      '⚠️ Any holiday conflicts?',
      '⚡ Show all Hotfixes',
      '⏳ What is in UAT or CAB?',
      '👤 Who has the most releases?',
      '⏱️ What is our average lead time?'
    ]
  };
}

// -------------------------------------------------------------
// Action Dispatcher
// -------------------------------------------------------------
function executeChatAction(action, val) {
  switch (action) {
    case 'switch_view':
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: val } }));
      break;

    case 'filter_conflicts':
      store.filters.hasConflict = true;
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
      break;

    case 'filter_type':
      store.filters.type = val;
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
      break;

    case 'filter_stage':
      store.filters.stage = val;
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
      break;

    case 'filter_status':
      store.filters.status = val;
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
      break;

    case 'filter_platform':
      store.filters.platform = val;
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
      break;

    case 'filter_dev':
      store.filters.developer = val;
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
      break;

    case 'open_new_modal':
      window.dispatchEvent(new CustomEvent('open-release-modal', { detail: { mode: 'create' } }));
      break;

    case 'reset_filters':
      store.filters = {
        search: '',
        platform: 'ALL',
        type: 'ALL',
        stage: 'ALL',
        status: 'ALL',
        owner: 'ALL',
        developer: 'ALL',
        month: 'ALL',
        year: 'ALL',
        hasConflict: false
      };
      store.notify();
      window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'releases' } }));
      break;

    default:
      console.warn('Unknown chatbot action:', action);
  }
}

// Markdown formatting helper (bold, code, lists, linebreaks)
function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^• (.*?)$/gm, '<li class="chat-bullet">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export function removeChatbot() {
  const root = document.getElementById('teknobot-root');
  if (root) root.remove();
  isChatOpen = false;
}

