export type Urgency = 'OVERDUE' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Bands a deadline by days-remaining — same tiers as the EduConnect India
 * reference reviewed for backlog ideas, minus its simulated WhatsApp/email
 * "escalatedTo" list (no messaging integration exists here; not faking one).
 */
export function bandUrgency(daysLeft: number): Urgency {
  if (daysLeft < 0) return 'OVERDUE';
  if (daysLeft <= 2) return 'CRITICAL';
  if (daysLeft <= 5) return 'HIGH';
  if (daysLeft <= 10) return 'MEDIUM';
  return 'LOW';
}

export function daysLeft(deadline: string, now: Date = new Date()): number {
  const day = 86400000;
  return Math.ceil((new Date(deadline).getTime() - now.getTime()) / day);
}
