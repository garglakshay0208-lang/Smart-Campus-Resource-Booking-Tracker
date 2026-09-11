/**
 * CampusFlow — Central State Management
 * Persistent reactive store with localStorage backup
 */

const STORAGE_KEY = 'campusflow_state_v1';

// Initial Campus Resources
const INITIAL_RESOURCES = [
  {
    id: 'innovation-lab',
    name: 'Innovation Lab',
    badge: 'Available now',
    location: 'Block A · 2nd Floor',
    capacity: 40,
    hours: '8:00 AM – 8:00 PM',
    operatingStart: '08:00',
    operatingEnd: '20:00',
    equipment: ['3D Printers', 'IoT Kits', 'Workstations', 'Projector'],
    isCurrent: true
  },
  {
    id: 'robotics-arena',
    name: 'Robotics Arena',
    badge: 'Available now',
    location: 'Block C · Ground Floor',
    capacity: 35,
    hours: '8:00 AM – 8:00 PM',
    operatingStart: '08:00',
    operatingEnd: '20:00',
    equipment: ['Motion Capture', 'Test Track', 'Soldering Stations', 'CNC Mill'],
    isCurrent: false
  },
  {
    id: 'seminar-hall-b',
    name: 'Seminar Hall B',
    badge: 'In Session',
    location: 'Block B · 1st Floor',
    capacity: 120,
    hours: '8:00 AM – 8:00 PM',
    operatingStart: '08:00',
    operatingEnd: '20:00',
    equipment: ['Dual Laser Projectors', 'Dolby Surround', 'Wireless Mics', 'Lecture Capture'],
    isCurrent: false
  }
];

// Seed facility schedule bookings (Friday schedule):
// 09:00–10:30 Robotics Club
// 11:00–12:00 Design Team
// 14:00–16:00 AI Society
// 17:00–18:30 Innovation Cell
const INITIAL_BOOKINGS = [
  {
    id: 'bk-101',
    resourceId: 'innovation-lab',
    date: '2026-09-11',
    startTime: '09:00',
    endTime: '10:30',
    title: 'Robotics Club',
    team: 'Robotics Club',
    participants: 18,
    bookedBy: 'Alex Chen',
    status: 'CONFIRMED',
    dynamoLockId: 'LOCK#INNOV#0900_1030',
    isUserBooking: false
  },
  {
    id: 'bk-102',
    resourceId: 'innovation-lab',
    date: '2026-09-11',
    startTime: '11:00',
    endTime: '12:00',
    title: 'Design Team Sprint',
    team: 'Design Team',
    participants: 12,
    bookedBy: 'Lakshay Garg',
    status: 'CONFIRMED',
    dynamoLockId: 'LOCK#INNOV#1100_1200',
    isUserBooking: true
  },
  {
    id: 'bk-103',
    resourceId: 'innovation-lab',
    date: '2026-09-11',
    startTime: '14:00',
    endTime: '16:00',
    title: 'AI Society',
    team: 'AI Society',
    participants: 28,
    bookedBy: 'Dr. Sarah Jenkins',
    status: 'CONFIRMED',
    dynamoLockId: 'LOCK#INNOV#1400_1600',
    isUserBooking: false
  },
  {
    id: 'bk-104',
    resourceId: 'innovation-lab',
    date: '2026-09-11',
    startTime: '17:00',
    endTime: '18:30',
    title: 'Innovation Cell',
    team: 'Innovation Cell',
    participants: 22,
    bookedBy: 'Prof. Ramesh Patel',
    status: 'CONFIRMED',
    dynamoLockId: 'LOCK#INNOV#1700_1830',
    isUserBooking: false
  }
];

class Store {
  constructor() {
    this.subscribers = [];
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = window.localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.bookings && parsed.bookings.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      // fallback to initial state
    }

    return {
      currentUser: {
        name: 'Lakshay Garg',
        role: 'Student',
        dept: 'Computer Science & AI',
        avatar: 'LG',
        email: 'lakshay.garg@campus.edu'
      },
      currentDate: '2026-09-11',
      activeResourceId: 'innovation-lab',
      resources: INITIAL_RESOURCES,
      bookings: INITIAL_BOOKINGS,
      notifications: [
        {
          id: 'n1',
          time: '10 min ago',
          title: 'Booking Confirmed',
          text: 'Design Team Sprint confirmed for 11:00 AM in Innovation Lab.',
          unread: true
        },
        {
          id: 'n2',
          time: '1 hour ago',
          title: 'AWS EventBridge Sync',
          text: 'Calendar synchronization completed across campus gateway.',
          unread: false
        }
      ]
    };
  }

  saveState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.error('Failed to persist state:', e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.subscribers.push(listener);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== listener);
    };
  }

  notify() {
    this.subscribers.forEach(listener => listener(this.state));
  }

  // Getters
  getCurrentUser() {
    return this.state.currentUser;
  }

  getActiveResource() {
    return this.state.resources.find(r => r.id === this.state.activeResourceId) || this.state.resources[0];
  }

  getBookingsForResource(resourceId = this.state.activeResourceId, date = this.state.currentDate) {
    return this.state.bookings
      .filter(b => b.resourceId === resourceId && b.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  getUserBookings() {
    return this.state.bookings.filter(b => b.isUserBooking);
  }

  setActiveResource(resourceId) {
    this.state.activeResourceId = resourceId;
    this.saveState();
  }

  // Add new booking with simulated DynamoDB Lock
  addBooking(bookingData) {
    const newId = 'bk-' + Math.floor(1000 + Math.random() * 9000);
    const lockKey = `LOCK#${bookingData.resourceId.toUpperCase()}#${bookingData.startTime.replace(':', '')}_${bookingData.endTime.replace(':', '')}`;

    const newBooking = {
      id: newId,
      resourceId: bookingData.resourceId || this.state.activeResourceId,
      date: bookingData.date || this.state.currentDate,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      title: bookingData.purpose || 'Campus Resource Reservation',
      team: bookingData.team || 'Student Project',
      participants: parseInt(bookingData.participants, 10) || 1,
      notes: bookingData.notes || '',
      bookedBy: this.state.currentUser.name,
      status: 'CONFIRMED',
      dynamoLockId: lockKey,
      isUserBooking: true,
      createdAt: new Date().toISOString()
    };

    this.state.bookings.push(newBooking);

    // Add notification
    this.state.notifications.unshift({
      id: 'notif-' + Date.now(),
      time: 'Just now',
      title: 'New Booking Confirmed',
      text: `${newBooking.title} booked for ${newBooking.startTime}–${newBooking.endTime} in ${this.getActiveResource().name}.`,
      unread: true
    });

    this.saveState();
    return newBooking;
  }

  // Cancel booking
  cancelBooking(bookingId) {
    const booking = this.state.bookings.find(b => b.id === bookingId);
    if (!booking) return false;

    this.state.bookings = this.state.bookings.filter(b => b.id !== bookingId);

    this.state.notifications.unshift({
      id: 'notif-' + Date.now(),
      time: 'Just now',
      title: 'Booking Cancelled',
      text: `Reservation for ${booking.title} has been cancelled and slot released.`,
      unread: true
    });

    this.saveState();
    return true;
  }

  resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.loadState();
    this.notify();
  }
}

export const store = new Store();
