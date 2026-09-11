/**
 * CampusFlow — Application Orchestrator & UI Controller
 * Manages Views, Tabs, Toast Notifications & AWS Architecture Simulator
 */

import { store } from './state.js';
import { AvailabilityTimeline } from './timeline.js';
import { BookingModal } from './bookingModal.js';
import { formatTo12Hour } from './conflictEngine.js';

class App {
  constructor() {
    this.currentView = 'landing'; // 'landing' | 'dashboard'
    this.currentTab = 'overview'; // 'overview' | 'availability' | 'calendar' | 'bookings' | 'architecture'
    this.timeline = null;
    this.bookingModal = null;

    this.init();
  }

  init() {
    // Expose global toast helper
    window.showToast = this.showToast.bind(this);
    window.switchDashboardTab = this.switchTab.bind(this);

    // Initialize Components
    this.bookingModal = new BookingModal();
    this.timeline = new AvailabilityTimeline('timeline-mount', {
      onSlotClick: (slotInfo) => {
        this.bookingModal.open({
          date: slotInfo.date,
          startTime: slotInfo.startTime,
          endTime: slotInfo.endTime
        });
      }
    });

    // Wire Navigation & View Toggles
    this.setupViewNavigation();
    this.setupTabNavigation();
    this.setupResourceSelector();
    this.setupMyBookingsActions();
    this.setupAwsSimulator();
    this.setupNotifications();
    this.initTheme();

    // Subscribe to state changes to update KPI cards & header
    store.subscribe(() => this.updateDashboardMetrics());
    this.updateDashboardMetrics();

    // Check URL Hash for deep linking
    if (window.location.hash === '#dashboard' || window.location.hash.startsWith('#dashboard-')) {
      this.switchView('dashboard');
      const tabMatch = window.location.hash.replace('#dashboard-', '');
      if (['overview', 'availability', 'calendar', 'bookings', 'architecture'].includes(tabMatch)) {
        this.switchTab(tabMatch);
      }
    } else {
      this.switchView('landing');
    }
  }

  // Toast System
  showToast({ title, message, type = 'info', duration = 4000 }) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '🟢' : (type === 'error' ? '🔴' : '⚡');

    toast.innerHTML = `
      <div style="font-size: 1.25rem;">${icon}</div>
      <div>
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // View Navigation (Landing ↔ Dashboard)
  setupViewNavigation() {
    const landingView = document.getElementById('view-landing');
    const dashboardView = document.getElementById('view-dashboard');

    const triggerButtons = document.querySelectorAll('.btn-enter-app, .btn-explore-timeline, #btn-book-hero');
    triggerButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Return to landing buttons
    document.querySelectorAll('.btn-return-landing').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView('landing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Hero Floating Visual interactive trigger
    const heroMiniTimeline = document.querySelector('.hero-mini-schedule');
    heroMiniTimeline?.addEventListener('click', () => {
      this.switchView('dashboard');
      this.showToast({
        title: 'Entering Campus Schedule',
        message: 'Live Innovation Lab availability loaded.',
        type: 'info'
      });
    });

    // Resource Hero Card "Book Now" Button
    document.getElementById('btn-hero-book-now')?.addEventListener('click', () => {
      this.bookingModal.open();
    });

    // "View Schedule" Scroll Button
    document.getElementById('btn-hero-view-schedule')?.addEventListener('click', () => {
      document.getElementById('timeline-mount')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;
    const landingEl = document.getElementById('view-landing');
    const dashboardEl = document.getElementById('view-dashboard');

    if (viewName === 'dashboard') {
      landingEl.style.display = 'none';
      dashboardEl.style.display = 'grid';
      window.location.hash = '#dashboard';
      // Re-render timeline to fit refreshed layout dimensions
      setTimeout(() => this.timeline.render(), 50);
    } else {
      landingEl.style.display = 'block';
      dashboardEl.style.display = 'none';
      window.location.hash = '';
    }
  }

  // Dashboard Tab Switching
  setupTabNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav-item[data-tab]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update active sidebar nav
    document.querySelectorAll('.sidebar-nav-item[data-tab]').forEach(item => {
      if (item.getAttribute('data-tab') === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Show corresponding tab section
    document.querySelectorAll('.dashboard-view-section').forEach(section => {
      if (section.id === `tab-section-${tabName}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    if (tabName === 'bookings') {
      this.renderMyBookingsList();
    } else if (tabName === 'calendar') {
      this.renderCalendarGrid();
    }

    window.location.hash = `#dashboard-${tabName}`;
  }

  // Switch Active Resource
  setupResourceSelector() {
    const selectorButtons = document.querySelectorAll('.resource-switch-btn');
    selectorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const resourceId = btn.getAttribute('data-resource-id');
        store.setActiveResource(resourceId);

        selectorButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.showToast({
          title: 'Active Resource Switched',
          message: `Viewing live schedule for ${store.getActiveResource().name}.`,
          type: 'info'
        });
      });
    });
  }

  // Update KPI Cards & Hero Resource Content
  updateDashboardMetrics() {
    const resource = store.getActiveResource();
    const date = store.state.currentDate;
    const bookings = store.getBookingsForResource(resource.id, date);
    const userBookings = store.getUserBookings();

    // 1. Available Now Card
    // Lab is currently available if no booking covers right now (or default 1 available)
    const kpiAvailableNum = document.getElementById('kpi-available-num');
    const kpiAvailableLab = document.getElementById('kpi-available-lab');
    if (kpiAvailableNum) kpiAvailableNum.textContent = '1';
    if (kpiAvailableLab) kpiAvailableLab.textContent = `${resource.name}`;

    // 2. Today's Bookings Card
    const kpiTodayCount = document.getElementById('kpi-today-count');
    if (kpiTodayCount) {
      // Total campus bookings (Innovation lab bookings + other halls)
      kpiTodayCount.textContent = String(bookings.length + 4);
    }

    // 3. My Upcoming Card
    const kpiMyUpcoming = document.getElementById('kpi-my-upcoming');
    const kpiMyNext = document.getElementById('kpi-my-next');
    if (kpiMyUpcoming) kpiMyUpcoming.textContent = String(userBookings.length || 1);
    if (kpiMyNext && userBookings.length > 0) {
      kpiMyNext.textContent = `Next: ${formatTo12Hour(userBookings[0].startTime)}`;
    }

    // 4. Resource Hero Card elements
    const heroTitle = document.getElementById('hero-card-name');
    const heroLocation = document.getElementById('hero-card-location');
    const heroCapacity = document.getElementById('hero-card-capacity');
    const heroHours = document.getElementById('hero-card-hours');
    const heroEquipment = document.getElementById('hero-card-equipment');

    if (heroTitle) heroTitle.textContent = resource.name;
    if (heroLocation) heroLocation.textContent = resource.location;
    if (heroCapacity) heroCapacity.textContent = `Capacity ${resource.capacity}`;
    if (heroHours) heroHours.textContent = resource.hours;
    if (heroEquipment) {
      heroEquipment.innerHTML = resource.equipment.map(eq => `
        <span class="equipment-pill">${eq}</span>
      `).join('');
    }

    // Update My Bookings count badge in sidebar
    const bookingsBadge = document.getElementById('sidebar-bookings-badge');
    if (bookingsBadge) {
      bookingsBadge.textContent = String(userBookings.length);
    }

    // Update My Bookings tab if visible
    if (this.currentTab === 'bookings') {
      this.renderMyBookingsList();
    }
  }

  // Render "My Bookings" Tab
  renderMyBookingsList() {
    const container = document.getElementById('my-bookings-list');
    if (!container) return;

    const bookings = store.getUserBookings();

    if (bookings.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-subtle);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">📅</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">No active bookings</h3>
          <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto 20px;">You haven't reserved any campus resources yet. Pick an available slot in the timeline to make your first reservation.</p>
          <button class="btn btn-primary" onclick="window.switchDashboardTab('overview')">Browse Available Slots</button>
        </div>
      `;
      return;
    }

    container.innerHTML = bookings.map(b => {
      const res = store.state.resources.find(r => r.id === b.resourceId) || store.getActiveResource();
      return `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; margin-bottom: 16px;">
          <div style="display: flex; gap: 16px; align-items: center;">
            <div style="width: 52px; height: 52px; border-radius: var(--radius-md); background: var(--accent-aws-subtle); border: 1px solid var(--border-active); color: var(--accent-aws); display: flex; align-items: center; justify-content: center; font-weight: 800; font-family: var(--font-mono); font-size: 0.9rem;">
              ${b.startTime}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                <h4 style="font-size: 1.125rem; font-weight: 700;">${b.title}</h4>
                <span class="badge badge-aws">Confirmed · Lock Acquired</span>
              </div>
              <div style="font-size: 0.8125rem; color: var(--text-secondary); display: flex; align-items: center; gap: 16px;">
                <span>📍 ${res.name} (${res.location})</span>
                <span>🕒 ${formatTo12Hour(b.startTime)} – ${formatTo12Hour(b.endTime)}</span>
                <span>👥 ${b.participants} participants</span>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              ID: CF-${b.id.toUpperCase()}
            </div>
            <button class="btn btn-secondary btn-sm btn-cancel-booking" data-id="${b.id}">
              Cancel & Release Slot
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach cancel booking listeners
    container.querySelectorAll('.btn-cancel-booking').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to cancel this reservation? The slot will immediately be released back to other students.')) {
          store.cancelBooking(id);
          this.showToast({
            title: 'Reservation Released',
            message: 'Slot successfully cleared in DynamoDB and returned to campus pool.',
            type: 'info'
          });
        }
      });
    });
  }

  // Render Calendar Grid View
  renderCalendarGrid() {
    const container = document.getElementById('calendar-grid-mount');
    if (!container) return;

    const days = [
      { name: 'Mon', date: 'Sep 07', active: false },
      { name: 'Tue', date: 'Sep 08', active: false },
      { name: 'Wed', date: 'Sep 09', active: false },
      { name: 'Thu', date: 'Sep 10', active: false },
      { name: 'Fri', date: 'Sep 11 (Today)', active: true },
      { name: 'Sat', date: 'Sep 12', active: false }
    ];

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-top: 16px;">
        ${days.map(d => `
          <div class="card" style="padding: 16px; border-color: ${d.active ? 'var(--border-active)' : 'var(--border-subtle)'}; background: ${d.active ? 'rgba(255, 153, 0, 0.04)' : 'var(--bg-card)'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
              <span style="font-weight: 700; font-size: 0.875rem; color: ${d.active ? 'var(--accent-aws)' : 'var(--text-primary)'}">${d.name}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${d.date}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${d.active ? `
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 8px; font-size: 0.75rem;">
                  <strong style="color: #FCA5A5;">09:00 - 10:30</strong>
                  <div>Robotics Club</div>
                </div>
                <div style="background: rgba(255, 153, 0, 0.15); border: 1px solid var(--border-active); border-radius: var(--radius-sm); padding: 8px; font-size: 0.75rem;">
                  <strong style="color: var(--accent-aws);">11:00 - 12:00</strong>
                  <div>Design Team Sprint</div>
                </div>
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 8px; font-size: 0.75rem;">
                  <strong style="color: #FCA5A5;">14:00 - 16:00</strong>
                  <div>AI Society</div>
                </div>
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 8px; font-size: 0.75rem;">
                  <strong style="color: #FCA5A5;">17:00 - 18:30</strong>
                  <div>Innovation Cell</div>
                </div>
              ` : `
                <div style="color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 20px 0;">
                  Open Availability
                </div>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  setupMyBookingsActions() {
    // Reset seed data trigger
    document.getElementById('btn-reset-demo')?.addEventListener('click', () => {
      if (confirm('Reset CampusFlow to original demo seed state?')) {
        store.resetToDefault();
        this.showToast({
          title: 'Demo State Restored',
          message: 'All default bookings and resources reset successfully.',
          type: 'success'
        });
      }
    });
  }

  // AWS Architecture Interactive Simulator
  setupAwsSimulator() {
    const btnSimulate = document.getElementById('btn-run-dynamo-sim');
    const terminalOutput = document.getElementById('dynamo-sim-output');

    btnSimulate?.addEventListener('click', () => {
      if (!terminalOutput) return;

      terminalOutput.innerHTML = `
<span class="terminal-accent">> AWS DynamoDB ConditionCheck Simulation Initiated</span>
[INFO] Sending TransactWriteItems to Table: "CampusFlow-Reservations-Prod"
[INFO] Target Partition Key: RESOURCE#INNOVATION_LAB#2026-09-11
[INFO] Sort Key / Time Lock: SLOT#1400_1600
[TEST 1: Race Condition Attempt by Client B while Client A is holding lock]
`;

      setTimeout(() => {
        terminalOutput.innerHTML += `
<span class="terminal-error">HTTP 400 TransactionCanceledException: ConditionalCheckFailed</span>
[REASON] ConditionExpression "attribute_not_exists(slotKey)" evaluated to FALSE.
[SAFETY RESULT] Race condition aborted. Client B booking rejected. ZERO DOUBLE BOOKING OCCURRED!
`;
      }, 500);

      setTimeout(() => {
        terminalOutput.innerHTML += `
<br>
<span class="terminal-accent">[TEST 2: Normal Available Booking (16:00 - 17:00)]</span>
[INFO] ConditionExpression "attribute_not_exists(SLOT#1600_1700)" -> TRUE
<span class="terminal-success">HTTP 200 OK — Atomic Lock Acquired in 9ms.</span>
[EVENTBRIDGE] Emitted ResourceBookedEvent -> WebSockets timeline push & calendar sync triggered!
`;
      }, 1100);
    });
  }

  initTheme() {
    let savedTheme = 'dark';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        savedTheme = window.localStorage.getItem('campusflow_theme') || 'dark';
      }
    } catch (e) {}

    this.setTheme(savedTheme, false);

    // Attach click listeners to all theme toggle buttons
    document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleTheme();
      });
    });

    // Attach listener to settings dropdown
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) {
      themeSelect.value = savedTheme;
      themeSelect.addEventListener('change', (e) => {
        this.setTheme(e.target.value, true);
      });
    }
  }

  setTheme(theme, notify = true) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('campusflow_theme', theme);
      }
    } catch (e) {}

    // Update icons: in dark mode, show sun to toggle to light; in light mode, show moon to toggle to dark
    const sunIcons = document.querySelectorAll('.theme-icon-sun');
    const moonIcons = document.querySelectorAll('.theme-icon-moon');

    if (theme === 'light') {
      sunIcons.forEach(icon => icon.style.display = 'none');
      moonIcons.forEach(icon => icon.style.display = 'inline-block');
    } else {
      sunIcons.forEach(icon => icon.style.display = 'inline-block');
      moonIcons.forEach(icon => icon.style.display = 'none');
    }

    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect && themeSelect.value !== theme) {
      themeSelect.value = theme;
    }

    if (notify) {
      this.showToast({
        title: `${theme === 'light' ? '☀️ Light' : '🌙 Dark'} Mode Active`,
        message: `Theme and high-contrast typography updated.`,
        type: 'info'
      });
    }
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme, true);
  }

  setupNotifications() {
    const notifBtn = document.getElementById('btn-notifications-toggle');
    notifBtn?.addEventListener('click', () => {
      const notifs = store.state.notifications;
      const msg = notifs.map(n => `• [${n.time}] ${n.title}: ${n.text}`).join('\n\n');
      alert(`CampusFlow Notifications:\n\n${msg}`);
    });
  }
}

// Bootstrap once DOM loads
document.addEventListener('DOMContentLoaded', () => {
  window.campusFlowApp = new App();
});
