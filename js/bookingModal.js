/**
 * CampusFlow — Booking Modal & Interaction Controller
 * Handles interactive booking, real-time conflict validation & AWS simulation
 */

import { store } from './state.js';
import { detectConflict, generateSmartAlternatives, formatTo12Hour } from './conflictEngine.js';

export class BookingModal {
  constructor() {
    this.modalOverlay = document.getElementById('booking-modal-overlay');
    this.form = document.getElementById('booking-form');
    this.conflictBanner = document.getElementById('conflict-banner');
    this.conflictMessage = document.getElementById('conflict-message');
    this.alternativeChipsContainer = document.getElementById('alternative-chips');
    this.submitBtn = document.getElementById('btn-confirm-booking');
    this.closeBtn = document.getElementById('btn-close-booking-modal');
    this.cancelBtn = document.getElementById('btn-cancel-booking-modal');

    // Inputs
    this.inputDate = document.getElementById('book-date');
    this.inputStartTime = document.getElementById('book-start-time');
    this.inputEndTime = document.getElementById('book-end-time');
    this.inputPurpose = document.getElementById('book-purpose');
    this.inputParticipants = document.getElementById('book-participants');
    this.inputTeam = document.getElementById('book-team');
    this.inputNotes = document.getElementById('book-notes');
    this.modalTitle = document.getElementById('booking-modal-title');
    this.modalSubtitle = document.getElementById('booking-modal-subtitle');

    // Success Modal elements
    this.successOverlay = document.getElementById('success-modal-overlay');
    this.btnSuccessClose = document.getElementById('btn-success-close');
    this.btnSuccessViewBookings = document.getElementById('btn-success-view-bookings');
    this.btnDownloadIcs = document.getElementById('btn-download-ics');

    this.currentBookingData = null;
    this.init();
  }

  init() {
    if (!this.modalOverlay) return;

    // Close buttons
    this.closeBtn?.addEventListener('click', () => this.close());
    this.cancelBtn?.addEventListener('click', () => this.close());
    this.btnSuccessClose?.addEventListener('click', () => this.closeSuccess());

    // Close on backdrop click
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.close();
    });

    this.successOverlay?.addEventListener('click', (e) => {
      if (e.target === this.successOverlay) this.closeSuccess();
    });

    // Form inputs change listener for live conflict detection
    const handleTimeChange = () => this.validateTimes();
    this.inputStartTime?.addEventListener('change', handleTimeChange);
    this.inputStartTime?.addEventListener('input', handleTimeChange);
    this.inputEndTime?.addEventListener('change', handleTimeChange);
    this.inputEndTime?.addEventListener('input', handleTimeChange);
    this.inputDate?.addEventListener('change', handleTimeChange);

    // Form Submit
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Success Actions
    this.btnSuccessViewBookings?.addEventListener('click', () => {
      this.closeSuccess();
      window.switchDashboardTab?.('bookings');
    });

    this.btnDownloadIcs?.addEventListener('click', () => {
      this.downloadIcsFile();
    });
  }

  open(prefill = {}) {
    const resource = store.getActiveResource();
    const date = prefill.date || store.state.currentDate;

    if (this.modalTitle) {
      this.modalTitle.textContent = `Book ${resource.name}`;
    }
    if (this.modalSubtitle) {
      this.modalSubtitle.innerHTML = `📍 ${resource.location} · 👥 Cap: ${resource.capacity} · 🕐 ${resource.hours}`;
    }

    // Default times
    let start = prefill.startTime || '12:00';
    let end = prefill.endTime || '13:00';

    if (this.inputDate) this.inputDate.value = date;
    if (this.inputStartTime) this.inputStartTime.value = start;
    if (this.inputEndTime) this.inputEndTime.value = end;
    if (this.inputPurpose) this.inputPurpose.value = prefill.purpose || '';
    if (this.inputParticipants) this.inputParticipants.value = prefill.participants || '10';
    if (this.inputTeam) this.inputTeam.value = prefill.team || 'Computer Science & AI Society';
    if (this.inputNotes) this.inputNotes.value = prefill.notes || '';

    this.modalOverlay.classList.add('active');
    this.validateTimes();

    setTimeout(() => {
      this.inputPurpose?.focus();
    }, 150);
  }

  close() {
    this.modalOverlay.classList.remove('active');
    this.hideConflict();
  }

  closeSuccess() {
    if (this.successOverlay) {
      this.successOverlay.classList.remove('active');
    }
  }

  validateTimes() {
    const resource = store.getActiveResource();
    const date = this.inputDate?.value || store.state.currentDate;
    const start = this.inputStartTime?.value;
    const end = this.inputEndTime?.value;

    if (!start || !end) return;

    const conflictResult = detectConflict(resource.id, date, start, end);

    if (conflictResult.hasConflict) {
      this.showConflict(conflictResult, resource, date, start, end);
    } else {
      this.hideConflict();
    }
  }

  showConflict(conflictResult, resource, date, start, end) {
    if (!this.conflictBanner) return;

    this.conflictBanner.classList.add('active');
    if (this.conflictMessage) {
      this.conflictMessage.textContent = conflictResult.reason || `${resource.name} is already reserved for this duration.`;
    }

    // Generate Smart Alternatives
    const alternatives = generateSmartAlternatives(resource.id, date, start, end);
    this.renderAlternatives(alternatives);

    // Disable Submit Button with feedback
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.style.opacity = '0.5';
      this.submitBtn.style.cursor = 'not-allowed';
      this.submitBtn.innerHTML = `⚠️ Conflict Detected`;
    }
  }

  hideConflict() {
    if (this.conflictBanner) {
      this.conflictBanner.classList.remove('active');
    }
    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.style.opacity = '1';
      this.submitBtn.style.cursor = 'pointer';
      this.submitBtn.innerHTML = `Confirm Booking`;
    }
  }

  renderAlternatives(alternatives) {
    if (!this.alternativeChipsContainer) return;

    this.alternativeChipsContainer.innerHTML = alternatives.map(alt => `
      <button type="button" class="alt-chip-btn" data-start="${alt.startTime}" data-end="${alt.endTime}" data-date="${alt.date}">
        <span>✨ ${alt.label}</span>
      </button>
    `).join('');

    // Attach alternative click listener to auto-apply slot
    this.alternativeChipsContainer.querySelectorAll('.alt-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const altStart = btn.getAttribute('data-start');
        const altEnd = btn.getAttribute('data-end');
        const altDate = btn.getAttribute('data-date');

        if (this.inputStartTime) this.inputStartTime.value = altStart;
        if (this.inputEndTime) this.inputEndTime.value = altEnd;
        if (this.inputDate && altDate) this.inputDate.value = altDate;

        // Re-validate and clear conflict
        this.validateTimes();

        window.showToast?.({
          type: 'success',
          title: 'Time Slot Updated',
          message: `Switched to non-conflicting time: ${formatTo12Hour(altStart)} – ${formatTo12Hour(altEnd)}.`
        });
      });
    });
  }

  handleSubmit() {
    const resource = store.getActiveResource();
    const date = this.inputDate?.value || store.state.currentDate;
    const start = this.inputStartTime?.value;
    const end = this.inputEndTime?.value;

    // Final safety conflict check
    const check = detectConflict(resource.id, date, start, end);
    if (check.hasConflict) {
      this.showConflict(check, resource, date, start, end);
      return;
    }

    // Prepare simulated DynamoDB Atomic Transaction
    const originalBtnText = this.submitBtn.innerHTML;
    this.submitBtn.disabled = true;
    this.submitBtn.innerHTML = `
      <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 0.8s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/>
      </svg>
      DynamoDB Conditional Check...
    `;

    setTimeout(() => {
      // Create Booking in reactive store
      const newBooking = store.addBooking({
        resourceId: resource.id,
        date: date,
        startTime: start,
        endTime: end,
        purpose: this.inputPurpose?.value || 'Campus Project Sprint',
        participants: this.inputParticipants?.value || 1,
        team: this.inputTeam?.value || 'Student Guild',
        notes: this.inputNotes?.value || ''
      });

      this.currentBookingData = newBooking;
      this.close();
      this.showSuccessModal(newBooking, resource);

      // Reset button
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = originalBtnText;

      window.showToast?.({
        type: 'success',
        title: 'Zero-Conflict Reservation Secured!',
        message: `${newBooking.title} confirmed for ${formatTo12Hour(newBooking.startTime)} – ${formatTo12Hour(newBooking.endTime)}.`
      });
    }, 600);
  }

  showSuccessModal(booking, resource) {
    if (!this.successOverlay) return;

    const receiptResource = document.getElementById('receipt-resource');
    const receiptTime = document.getElementById('receipt-time');
    const receiptDate = document.getElementById('receipt-date');
    const receiptRef = document.getElementById('receipt-ref');
    const receiptDynamoKey = document.getElementById('receipt-dynamo-key');

    if (receiptResource) receiptResource.textContent = resource.name;
    if (receiptTime) receiptTime.textContent = `${formatTo12Hour(booking.startTime)} – ${formatTo12Hour(booking.endTime)}`;
    if (receiptDate) receiptDate.textContent = booking.date;
    if (receiptRef) receiptRef.textContent = `CF-${booking.id.toUpperCase()}`;
    if (receiptDynamoKey) receiptDynamoKey.textContent = booking.dynamoLockId;

    this.successOverlay.classList.add('active');
  }

  downloadIcsFile() {
    if (!this.currentBookingData) return;
    const b = this.currentBookingData;
    const resource = store.getActiveResource();

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CampusFlow//Zero Double Bookings//EN',
      'BEGIN:VEVENT',
      `SUMMARY:CampusFlow: ${b.title} (${resource.name})`,
      `DESCRIPTION:Campus resource booking confirmed via AWS DynamoDB.\\nLocation: ${resource.location}\\nTeam: ${b.team}`,
      `LOCATION:${resource.name} - ${resource.location}`,
      `DTSTART:${b.date.replace(/-/g, '')}T${b.startTime.replace(':', '')}00`,
      `DTEND:${b.date.replace(/-/g, '')}T${b.endTime.replace(':', '')}00`,
      `STATUS:CONFIRMED`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `campusflow-${b.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.showToast?.({
      type: 'success',
      title: 'Calendar File Downloaded',
      message: 'ICS file saved. Import it into Google Calendar, Apple Calendar, or Outlook.'
    });
  }
}
