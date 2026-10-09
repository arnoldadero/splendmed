import { ComingInPhase } from '@/components/coming-in-phase';

export const metadata = { title: 'Speak to a pharmacist' };

export default function Page() {
  return (
    <ComingInPhase
      phase="Not scheduled for v1"
      title="Speak to a pharmacist"
      what="Consultation booking is out of scope for the first release. In the meantime, call or visit the Kisumu CBD branch and a registered pharmacist will help."
    />
  );
}
