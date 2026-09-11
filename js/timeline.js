/**
 * CampusFlow — Availability Timeline Component
 * Signature 8 AM – 8 PM interactive visualization
 */

import { store } from './state.js';
import { timeToMinutes, minutesTo12, minutesTo24 } from './conflictEngine.js';

export class AvailabilityTimeline {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      startHour: 8,  // 8 AM
      endHour: 20,   // 8 PM
      onSlotClick: options.onSlotClick || (() => {}),
      ...options
    };

    this.init();
  }

  init() {
    if (!this.container) return;
    this.render();
    store.subscribe(() => this.render());
  }

  render() {
    if (!this.container) return;

    const resource = store.getActiveResource();
    const date = store.state.currentDate;
    const bookings = store.getBookingsForResource(resource.id, date);

    const timelineStartMinutes = this.options.startHour * 60; // 8:00 AM -> 480
    const timelineEndMinutes = this.options.endHour * 60;     // 8:00 PM -> 1200
    const totalMinutes = timelineEndMinutes - timelineStartMinutes; // 720 min

    // Build Hour Markers
    const hours = [];
    for (let h = this.options.startHour; h <= this.options.endHour; h++) {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      hours.push(`${displayHour} ${period}`);
    }

    const markersHtml = hours.slice(0, -1).map(h => `<div class="hour-marker">${h}</div>`).join('');
    const gridLinesHtml = hours.slice(0, -1).map(() => `<div class="grid-line"></div>`).join('');

    // Compute All Segments (Booked + Available)
    const segments = [];
    let currentMarker = timelineStartMinutes;

    bookings.forEach(b => {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      // Clamped within 8 AM - 8 PM
      const effectiveStart = Math.max(timelineStartMinutes, bStart);
      const effectiveEnd = Math.min(timelineEndMinutes, bEnd);

      // If gap exists before this booking, it is AVAILABLE
      if (effectiveStart > currentMarker) {
        segments.push({
          type: 'available',
          startMinutes: currentMarker,
          endMinutes: effectiveStart,
          startTime: minutesTo24(currentMarker),
          endTime: minutesTo24(effectiveStart)
        });
      }

      // Add BOOKED segment
      segments.push({
        type: 'booked',
        booking: b,
        startMinutes: effectiveStart,
        endMinutes: effectiveEnd,
        startTime: b.startTime,
        endTime: b.endTime,
        isUserBooking: b.isUserBooking
      });

      currentMarker = Math.max(currentMarker, effectiveEnd);
    });

    // Check if trailing available space remains until 8 PM
    if (currentMarker < timelineEndMinutes) {
      segments.push({
        type: 'available',
        startMinutes: currentMarker,
        endMinutes: timelineEndMinutes,
        startTime: minutesTo24(currentMarker),
        endTime: minutesTo24(timelineEndMinutes)
      });
    }

    // Render Segments HTML
    const segmentsHtml = segments.map((seg, idx) => {
      const leftPct = ((seg.startMinutes - timelineStartMinutes) / totalMinutes) * 100;
      const widthPct = ((seg.endMinutes - seg.startMinutes) / totalMinutes) * 100;

      if (seg.type === 'booked') {
        const userClass = seg.isUserBooking ? 'user-booking' : '';
        return `
          <div class="timeline-segment booked ${userClass}" 
               style="left: ${leftPct}%; width: calc(${widthPct}% - 2px);"
               title="${seg.booking.title} (${minutesTo12(seg.startMinutes)} – ${minutesTo12(seg.endMinutes)})"
               data-booking-id="${seg.booking.id}">
            <div class="segment-title">🔴 ${seg.booking.title}</div>
            <div class="segment-time">${seg.startTime} – ${seg.endTime}</div>
          </div>
        `;
      } else {
        return `
          <div class="timeline-segment available" 
               style="left: ${leftPct}%; width: calc(${widthPct}% - 2px);"
               data-start="${seg.startTime}"
               data-end="${seg.endTime}"
               role="button"
               tabindex="0"
               aria-label="Reserve slot from ${seg.startTime} to ${seg.endTime}">
            <span class="available-default-pill">🟢 ${seg.startTime}</span>
            <span class="available-hover-text">🟢 Click to reserve (${seg.startTime}–${seg.endTime})</span>
          </div>
        `;
      }
    }).join('');

    this.container.innerHTML = `
      <div class="timeline-track-container">
        <div class="timeline-hour-markers">
          ${markersHtml}
        </div>
        <div class="timeline-bar">
          <div class="timeline-grid-overlay">
            ${gridLinesHtml}
          </div>
          ${segmentsHtml}
        </div>
      </div>
    `;

    // Attach click handlers
    this.container.querySelectorAll('.timeline-segment.available').forEach(el => {
      el.addEventListener('click', () => {
        const start = el.getAttribute('data-start');
        const end = el.getAttribute('data-end');
        this.options.onSlotClick({
          resourceId: resource.id,
          date: date,
          startTime: start,
          endTime: end
        });
      });
    });

    this.container.querySelectorAll('.timeline-segment.booked').forEach(el => {
      el.addEventListener('click', () => {
        const title = el.getAttribute('title');
        window.showToast?.({
          type: 'info',
          title: 'Slot Reserved',
          message: `${title}. Select an available green slot or pick another time.`
        });
      });
    });
  }
}
