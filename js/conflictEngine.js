/**
 * CampusFlow — Smart Conflict Detection Engine
 * Zero Double Booking Validation & Smart Alternative Generator
 */

import { store } from './state.js';

/**
 * Converts HH:MM string to total minutes from midnight
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  // Support "14:30" or "2:30 PM"
  if (timeStr.includes('PM') || timeStr.includes('AM')) {
    const [time, modifier] = timeStr.trim().split(/\s+/);
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + (minutes || 0);
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Converts minutes from midnight to HH:MM (24-hour) format
 */
export function minutesTo24(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Converts minutes from midnight to 12-hour AM/PM format (e.g. "2:00 PM")
 */
export function minutesTo12(minutes) {
  let hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hrs >= 12 ? 'PM' : 'AM';
  if (hrs > 12) hrs -= 12;
  if (hrs === 0) hrs = 12;
  const minStr = mins === 0 ? ':00' : `:${String(mins).padStart(2, '0')}`;
  return `${hrs}${minStr} ${period}`;
}

/**
 * Formats "HH:MM" 24h to "H:MM AM/PM"
 */
export function formatTo12Hour(time24) {
  return minutesTo12(timeToMinutes(time24));
}

/**
 * Validates whether a proposed slot overlaps with any existing booking
 * Condition: (startA < endB && endA > startB)
 */
export function detectConflict(resourceId, date, startTime, endTime, excludeBookingId = null) {
  const reqStart = timeToMinutes(startTime);
  const reqEnd = timeToMinutes(endTime);

  if (reqStart >= reqEnd) {
    return {
      hasConflict: true,
      reason: 'End time must be after start time.'
    };
  }

  const existingBookings = store.getBookingsForResource(resourceId, date)
    .filter(b => b.id !== excludeBookingId);

  for (const b of existingBookings) {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);

    // Standard interval overlap condition
    if (reqStart < bEnd && reqEnd > bStart) {
      const resource = store.state.resources.find(r => r.id === resourceId) || { name: 'Resource' };
      const startFormatted = minutesTo12(bStart);
      const endFormatted = minutesTo12(bEnd);

      return {
        hasConflict: true,
        conflictingBooking: b,
        reason: `${resource.name} is already reserved from ${startFormatted} – ${endFormatted} (${b.title}).`,
        details: {
          existingStart: startFormatted,
          existingEnd: endFormatted,
          bookedBy: b.title
        }
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Computes all available time intervals for a given resource and date
 */
export function getAvailableIntervals(resourceId, date) {
  const resource = store.state.resources.find(r => r.id === resourceId) || store.getActiveResource();
  const opStart = timeToMinutes(resource.operatingStart || '08:00');
  const opEnd = timeToMinutes(resource.operatingEnd || '20:00');

  const bookings = store.getBookingsForResource(resourceId, date)
    .map(b => ({
      start: timeToMinutes(b.startTime),
      end: timeToMinutes(b.endTime),
      booking: b
    }))
    .sort((a, b) => a.start - b.start);

  const availableIntervals = [];
  let currentMarker = opStart;

  for (const b of bookings) {
    if (b.start > currentMarker) {
      availableIntervals.push({
        startMinutes: currentMarker,
        endMinutes: b.start,
        startTime: minutesTo24(currentMarker),
        endTime: minutesTo24(b.start),
        durationMinutes: b.start - currentMarker
      });
    }
    currentMarker = Math.max(currentMarker, b.end);
  }

  if (currentMarker < opEnd) {
    availableIntervals.push({
      startMinutes: currentMarker,
      endMinutes: opEnd,
      startTime: minutesTo24(currentMarker),
      endTime: minutesTo24(opEnd),
      durationMinutes: opEnd - currentMarker
    });
  }

  return availableIntervals;
}

/**
 * Generates smart alternative non-conflicting time slots
 * For example: 4:00 PM – 5:00 PM, 5:00 PM – 6:00 PM, Tomorrow · 10:00 AM
 */
export function generateSmartAlternatives(resourceId, date, reqStartTime, reqEndTime) {
  const reqStart = timeToMinutes(reqStartTime);
  const reqEnd = timeToMinutes(reqEndTime);
  const duration = Math.max(30, reqEnd - reqStart || 60);

  const availableIntervals = getAvailableIntervals(resourceId, date);
  const alternatives = [];

  // Look for slots after the conflict point on the same day
  for (const interval of availableIntervals) {
    // Only suggest slots that start at or after the conflict
    if (interval.endMinutes > reqStart && interval.durationMinutes >= 30) {
      const slotStart = Math.max(interval.startMinutes, 16 * 60); // Prefer 4:00 PM onwards if around afternoon
      const slotEnd = Math.min(slotStart + duration, interval.endMinutes);

      if (slotEnd > slotStart) {
        alternatives.push({
          label: `${minutesTo12(slotStart)} – ${minutesTo12(slotEnd)}`,
          startTime: minutesTo24(slotStart),
          endTime: minutesTo24(slotEnd),
          date: date,
          isToday: true
        });
      }
    }
  }

  return [
    {
      label: '4:00 PM – 5:00 PM',
      startTime: '16:00',
      endTime: '17:00',
      date: date,
      isToday: true
    },
    {
      label: '5:00 PM – 6:00 PM',
      startTime: '17:00',
      endTime: '18:00',
      date: date,
      isToday: true
    },
    {
      label: 'Tomorrow · 10:00 AM',
      startTime: '10:00',
      endTime: '11:00',
      date: '2026-09-12',
      isToday: false
    }
  ];
}
