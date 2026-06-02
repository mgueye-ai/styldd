export type AppointmentDetail = {
  id: string;
  service: string;
  styleId?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  date: string;
  time: string;
  duration: string;
  clientName: string;
  clientPhone: string;
  location: string;
  price: number;
  hairType: string;
  notes: string;
  depositPaid: boolean;
  depositAmount: number;
};

export const APPOINTMENTS: AppointmentDetail[] = [
  {
    id: 'upcoming-1',
    service: 'Fulani Braids',
    status: 'upcoming',
    date: 'Today, May 27',
    time: '4:00 PM – 6:00 PM',
    duration: '2 hrs',
    clientName: 'Aaliyah Johnson',
    clientPhone: '(860) 555-0142',
    location: 'Norwich, CT',
    price: 180,
    hairType: '4C Natural',
    notes: 'Client wants two small beads at the end of each braid. Bring extra rubber bands.',
    depositPaid: true,
    depositAmount: 50,
  },
  {
    id: 'completed-1',
    service: 'Boho Braids',
    status: 'completed',
    date: 'Today, May 27',
    time: '1:30 PM – 3:30 PM',
    duration: '2 hrs',
    clientName: 'Aaliyah Johnson',
    clientPhone: '(860) 555-0142',
    location: 'Norwich, CT',
    price: 220,
    hairType: '4C Natural',
    notes: 'Reference photo sent via Instagram DM. Waist-length bohemian style.',
    depositPaid: true,
    depositAmount: 60,
  },
  {
    id: 'completed-2',
    service: 'Quick Weave',
    status: 'completed',
    date: 'Today, May 27',
    time: '12:00 PM – 1:00 PM',
    duration: '1 hr',
    clientName: 'Destiny Williams',
    clientPhone: '(860) 555-0198',
    location: 'New London, CT',
    price: 130,
    hairType: '3B Curly',
    notes: 'Short bob style. Client prefers no glue near hairline.',
    depositPaid: false,
    depositAmount: 0,
  },
];

export function getAppointmentById(id: string) {
  return APPOINTMENTS.find((a) => a.id === id);
}
