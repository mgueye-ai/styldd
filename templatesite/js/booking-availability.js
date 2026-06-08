/**
 * Shared booking availability rules — mirrors src/lib/bookingAvailability.ts.
 * Uses booking_hours from the Styld app Schedule → Hours tab as the source of truth.
 */
(function (global) {
  var DEFAULT_HOURS = {
    closedWeekdays: [],
    slotDayStartHour: 8,
    slotDayStartMinute: 0,
    slotDayEndHour: 19,
    slotDayEndMinute: 30,
    slotStepMinutes: 30,
    sameDayLeadMinutes: 4320,
    saturdayLastStartHour: 14,
    saturdayLastStartMinute: 0,
    concurrentAppointmentCapacity: 2,
  };

  function minutesOfDay(hour, minute) {
    return hour * 60 + minute;
  }

  function defaultDayHours(hours) {
    return {
      startHour: hours.slotDayStartHour,
      startMinute: hours.slotDayStartMinute,
      endHour: hours.slotDayEndHour,
      endMinute: hours.slotDayEndMinute,
    };
  }

  function isWeekdayClosedNumber(hours, weekday) {
    var closed = Array.isArray(hours.closedWeekdays) ? hours.closedWeekdays : [];
    return closed.indexOf(weekday) >= 0;
  }

  function getDayHours(hours, weekday) {
    if (isWeekdayClosedNumber(hours, weekday)) return null;
    var custom =
      (hours.weekdayHours && (hours.weekdayHours[weekday] || hours.weekdayHours[String(weekday)])) ||
      null;
    return custom || defaultDayHours(hours);
  }

  function getDayWindowMinutes(hours, weekday) {
    var day = getDayHours(hours, weekday);
    if (!day) return null;
    return {
      start: minutesOfDay(day.startHour, day.startMinute),
      end: minutesOfDay(day.endHour, day.endMinute),
    };
  }

  function overlaps(a0, a1, b0, b1) {
    return a0 < b1 && b0 < a1;
  }

  function normalizeHours(raw) {
    if (global.StyldTenant && global.StyldTenant.normalizeBookingHours) {
      return global.StyldTenant.normalizeBookingHours(raw);
    }
    var source = raw && typeof raw === 'object' ? raw : {};
    return Object.assign({}, DEFAULT_HOURS, source);
  }

  function hoursFromCfg(cfg) {
    return normalizeHours({
      closedWeekdays: cfg.closedWeekdays,
      slotDayStartHour: cfg.slotDayStartHour,
      slotDayStartMinute: cfg.slotDayStartMinute,
      slotDayEndHour: cfg.slotDayEndHour,
      slotDayEndMinute: cfg.slotDayEndMinute,
      slotStepMinutes: cfg.slotStepMinutes,
      sameDayLeadMinutes: cfg.sameDayLeadMinutes,
      concurrentAppointmentCapacity: cfg.concurrentAppointmentCapacity,
      weekdayHours: cfg.weekdayHours,
    });
  }

  function createEngine(cfg, luxonDateTime) {
    var DT = luxonDateTime;
    var hours = hoursFromCfg(cfg || {});
    var zone = (cfg && cfg.salonTimeZone) || 'America/New_York';
    var strictNoOverlap = !!(cfg && cfg.strictNoOverlap);

    function parseIsoDateLocal(isoDate) {
      var parts = isoDate.split('-').map(Number);
      return DT.fromObject(
        { year: parts[0], month: parts[1], day: parts[2] },
        { zone: zone },
      );
    }

    function weekdayFromIso(isoDate) {
      return parseIsoDateLocal(isoDate).weekday % 7;
    }

    function slotInstantOnDay(isoDate, minuteOfDay) {
      var parts = isoDate.split('-').map(Number);
      return DT.fromObject(
        {
          year: parts[0],
          month: parts[1],
          day: parts[2],
          hour: Math.floor(minuteOfDay / 60),
          minute: minuteOfDay % 60,
          second: 0,
          millisecond: 0,
        },
        { zone: zone },
      );
    }

    function isWeekdayClosed(isoDate) {
      return isWeekdayClosedNumber(hours, weekdayFromIso(isoDate));
    }

    function minAdvanceMs() {
      return Math.max(0, (hours.sameDayLeadMinutes || 0) * 60 * 1000);
    }

    function leadAdvanceLabel() {
      var mins = hours.sameDayLeadMinutes || 0;
      if (mins >= 24 * 60) {
        return 'Appointments require at least ' + Math.round(mins / 60) + ' hours advance notice.';
      }
      return 'Appointments require at least ' + mins + ' minutes advance notice.';
    }

    function generateSlotTimes(isoDate) {
      var weekday = weekdayFromIso(isoDate);
      if (isWeekdayClosedNumber(hours, weekday)) return [];
      var window = getDayWindowMinutes(hours, weekday);
      if (!window) return [];
      var step = Math.max(15, hours.slotStepMinutes || 30);
      var slots = [];
      for (var minute = window.start; minute <= window.end; minute += step) {
        slots.push(slotInstantOnDay(isoDate, minute));
      }
      return slots;
    }

    function dayHasBookableSlot(isoDate, nowMs) {
      var minMs = (nowMs || Date.now()) + minAdvanceMs();
      return generateSlotTimes(isoDate).some(function (slot) {
        return slot.toMillis() >= minMs;
      });
    }

    function calendarDayDisabledReason(isoDate, nowMs) {
      var today = DT.now().setZone(zone).startOf('day');
      var day = parseIsoDateLocal(isoDate).startOf('day');
      if (day < today) return 'Past dates cannot be booked.';
      if (isWeekdayClosed(isoDate)) return 'Closed this day.';
      if (!dayHasBookableSlot(isoDate, nowMs)) return leadAdvanceLabel();
      return null;
    }

    function overlapCount(candidateStartMs, candidateEndMs, busy) {
      var cap = Math.max(1, hours.concurrentAppointmentCapacity | 0);
      var count = 0;
      for (var i = 0; i < busy.length; i++) {
        var u = busy[i];
        if (!overlaps(candidateStartMs, candidateEndMs, u.start, u.end)) continue;
        if (u.isBlock) return cap;
        count += 1;
      }
      return count;
    }

    function classifySlot(slotStart, durationMin, busy, nowMs) {
      var startMs = slotStart.toMillis();
      var endMs = slotStart.plus({ minutes: durationMin }).toMillis();
      var now = nowMs || Date.now();
      var intervals = busy || [];

      if (startMs < now + minAdvanceMs()) {
        return { kind: 'full', reason: leadAdvanceLabel() };
      }

      if (strictNoOverlap) {
        for (var i = 0; i < intervals.length; i++) {
          var u = intervals[i];
          if (!overlaps(startMs, endMs, u.start, u.end)) continue;
          return {
            kind: 'full',
            reason: u.isBlock ? 'This time is blocked.' : 'This time is already booked.',
          };
        }
        return { kind: 'open', reason: '' };
      }

      var cap = Math.max(1, hours.concurrentAppointmentCapacity | 0);
      var overlapsFound = overlapCount(startMs, endMs, intervals);
      if (overlapsFound >= cap) return { kind: 'full', reason: 'Fully booked.' };
      if (overlapsFound === cap - 1 && cap > 1) {
        return { kind: 'limited', reason: 'Limited — one seat left for this window.' };
      }
      return { kind: 'open', reason: '' };
    }

    return {
      hours: hours,
      zone: zone,
      parseIsoDateLocal: parseIsoDateLocal,
      generateSlotTimes: generateSlotTimes,
      calendarDayDisabledReason: calendarDayDisabledReason,
      classifySlot: classifySlot,
      leadAdvanceLabel: leadAdvanceLabel,
      minAdvanceMs: minAdvanceMs,
      isWeekdayClosed: isWeekdayClosed,
      dayHasBookableSlot: dayHasBookableSlot,
    };
  }

  global.BookingAvailability = {
    DEFAULT_HOURS: DEFAULT_HOURS,
    normalizeHours: normalizeHours,
    createEngine: createEngine,
  };

  global.StyldTenant = global.StyldTenant || {};
  global.StyldTenant.normalizeBookingHours = normalizeHours;
})(window);
