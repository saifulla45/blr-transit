import { describe, expect, it } from 'vitest';
import { WHATSAPP_TICKET_URL, whatsappTicketLink } from '../fares';

describe('whatsappTicketLink', () => {
  it('asks Android for WhatsApp by package and falls back to wa.me', () => {
    const link = whatsappTicketLink('android');
    expect(link).toMatch(/^intent:\/\/send\?phone=918105556677&text=Hi#Intent;scheme=whatsapp;package=com\.whatsapp;/);
    expect(decodeURIComponent(link.split('S.browser_fallback_url=')[1])).toBe(`${WHATSAPP_TICKET_URL};end`);
  });

  it('opens the iPhone app directly instead of the Continue-to-chat page', () => {
    expect(whatsappTicketLink('ios')).toBe('whatsapp://send?phone=918105556677&text=Hi');
  });

  it('keeps wa.me on desktop, where it opens WhatsApp Web', () => {
    expect(whatsappTicketLink('other')).toBe('https://wa.me/918105556677?text=Hi');
  });
});
