export type ClientEmailTemplateId =
  | 'book_again'
  | 'thank_you'
  | 'promo'
  | 'check_in'
  | 'custom';

export type ClientEmailTemplate = {
  id: ClientEmailTemplateId;
  label: string;
  description: string;
  defaultSubject: string;
  previewLine: string;
};

export const CLIENT_EMAIL_TEMPLATES: ClientEmailTemplate[] = [
  {
    id: 'book_again',
    label: 'Book again',
    description: 'Invite them back for their next appointment',
    defaultSubject: 'Ready for your next appointment?',
    previewLine: "We'd love to see you again — book your next visit in just a few taps.",
  },
  {
    id: 'thank_you',
    label: 'Thank you',
    description: 'Show appreciation after a recent visit',
    defaultSubject: 'Thank you for visiting us!',
    previewLine: 'Thanks for choosing us. We hope you loved your style!',
  },
  {
    id: 'promo',
    label: 'Special offer',
    description: 'Share a promotion or limited-time deal',
    defaultSubject: 'A little something for you ✨',
    previewLine: 'We have a special offer just for our clients this week.',
  },
  {
    id: 'check_in',
    label: 'Check in',
    description: 'Friendly follow-up to stay in touch',
    defaultSubject: 'Just checking in',
    previewLine: 'Hope your style is still slaying! Let us know if you need anything.',
  },
  {
    id: 'custom',
    label: 'Custom message',
    description: 'Write your own subject and message',
    defaultSubject: '',
    previewLine: '',
  },
];

export function getClientEmailTemplate(id: ClientEmailTemplateId): ClientEmailTemplate {
  return CLIENT_EMAIL_TEMPLATES.find((t) => t.id === id) ?? CLIENT_EMAIL_TEMPLATES[0];
}
