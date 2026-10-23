import { describe, expect, it } from 'vitest';
import {
  calendarRange,
  classesToCsv,
  classroomInputSchema,
  expandSchedule,
  freeCoaches,
  weekDays,
} from './classroom';

const academyId = '10000000-0000-4000-8000-00000000000a';

describe('classroomInputSchema', () => {
  it('đặt tên mặc định "Class" và giá trị mặc định', () => {
    const v = classroomInputSchema.parse({ academyId, startsAt: '2026-11-02T18:00:00+07:00' });
    expect(v).toMatchObject({
      title: 'Class',
      kind: 'online',
      videoMode: 'performance',
      minutes: 60,
      repeat: null,
    });
  });
  it('từ chối lịch lặp rỗng và thời lượng ngoài phạm vi', () => {
    expect(
      classroomInputSchema.safeParse({
        academyId,
        startsAt: '2026-11-02T18:00:00+07:00',
        repeat: { schedule: [], weeks: 4 },
      }).success,
    ).toBe(false);
    expect(
      classroomInputSchema.safeParse({
        academyId,
        startsAt: '2026-11-02T18:00:00+07:00',
        minutes: 601,
      }).success,
    ).toBe(false);
  });
});

describe('expandSchedule', () => {
  it('sinh buổi theo thứ trong 2 tuần, bỏ buổi trước mốc bắt đầu', () => {
    // Thứ tư 04/11/2026 19:00 — buổi Thứ hai đầu tiên đã qua nên bắt đầu từ tuần sau
    const from = new Date(2026, 10, 4, 19, 0);
    const out = expandSchedule(
      [
        { day: 1, start: '18:00', minutes: 90 },
        { day: 3, start: '18:30', minutes: 60 },
        { day: 3, start: '19:30', minutes: 60 },
      ],
      from,
      2,
    );
    expect(
      out.map((o) => [o.startsAt.getDate(), o.startsAt.getHours(), o.startsAt.getMinutes()]),
    ).toEqual([
      [4, 19, 30],
      [9, 18, 0],
      [11, 18, 30],
      [11, 19, 30],
      [16, 18, 0],
    ]);
    expect(out[1]?.minutes).toBe(90);
  });
});

describe('calendarRange', () => {
  const now = new Date(2026, 10, 15);
  it('tháng, quý, năm', () => {
    expect(calendarRange('month', now)).toEqual({
      from: new Date(2026, 10, 1),
      to: new Date(2026, 11, 1),
    });
    expect(calendarRange('quarter', now)).toEqual({
      from: new Date(2026, 9, 1),
      to: new Date(2027, 0, 1),
    });
    expect(calendarRange('year', now)).toEqual({
      from: new Date(2026, 0, 1),
      to: new Date(2027, 0, 1),
    });
  });
});

describe('weekDays', () => {
  it('bắt đầu từ Thứ hai, kể cả khi hôm nay là Chủ nhật', () => {
    const days = weekDays(new Date(2026, 10, 8, 15));
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual(new Date(2026, 10, 2));
    expect(days[6]).toEqual(new Date(2026, 10, 8));
  });
});

describe('freeCoaches', () => {
  const availability = [
    { coachId: 'a', day: 1, start: '17:00', minutes: 180 },
    { coachId: 'b', day: 1, start: '18:00', minutes: 60 },
    { coachId: 'c', day: 2, start: '17:00', minutes: 240 },
  ];
  const start = new Date(2026, 10, 2, 18, 0); // Thứ hai
  const end = new Date(2026, 10, 2, 19, 0);
  it('chỉ HLV có lịch trống phủ trọn khoảng', () => {
    expect(freeCoaches(availability, [], start, end).sort()).toEqual(['a', 'b']);
    expect(freeCoaches(availability, [], start, new Date(2026, 10, 2, 19, 30))).toEqual(['a']);
  });
  it('loại HLV đã có sự kiện trùng giờ', () => {
    const events = [
      {
        coachId: 'a',
        startsAt: new Date(2026, 10, 2, 18, 30),
        endsAt: new Date(2026, 10, 2, 20, 0),
      },
      {
        coachId: 'b',
        startsAt: new Date(2026, 10, 2, 19, 0),
        endsAt: new Date(2026, 10, 2, 20, 0),
      },
    ];
    expect(freeCoaches(availability, events, start, end)).toEqual(['b']);
  });
});

describe('classesToCsv', () => {
  it('xuất giờ địa phương và số liệu điểm danh', () => {
    const csv = classesToCsv(
      [
        {
          title: 'Lớp A, buổi 1',
          kind: 'offline',
          startsAt: new Date(2026, 10, 2, 18, 5),
          minutes: 90,
          coach: 'HLV',
          present: 5,
          late: 1,
          absent: 2,
        },
      ],
      ['title', 'kind', 'start', 'minutes', 'coach', 'present', 'late', 'absent'],
    );
    expect(csv).toBe(
      'title,kind,start,minutes,coach,present,late,absent\r\n"Lớp A, buổi 1",offline,2026-11-02 18:05,90,HLV,5,1,2\r\n',
    );
  });
});
