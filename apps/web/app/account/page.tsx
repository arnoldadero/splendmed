import { ComingInPhase } from '@/components/coming-in-phase';

export const metadata = { title: 'Sign in' };

export default function Page() {
  return (
    <ComingInPhase
      phase="Phase 1"
      title="Sign in"
      what="Sign in to see your orders, saved addresses and prescription history. Phone OTP and email sign-in arrive in Phase 1, together with the row-level security that keeps your records yours."
    />
  );
}
