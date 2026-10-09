import { ComingInPhase } from '@/components/coming-in-phase';

export const metadata = { title: 'Upload a prescription' };

export default function Page() {
  return (
    <ComingInPhase
      phase="Phase 4"
      title="Upload a prescription"
      what="Photograph or upload your prescription and a registered pharmacist will check it before anything is dispensed. The upload flow, private storage and signed URLs land in Phase 4; the pharmacist review queue in Phase 6."
    />
  );
}
