import { ReviewSession } from "@/components/ReviewSession";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  return (
    <main className="narrow">
      <h1>Daily review</h1>
      <p className="big muted">Short questions you found tricky before. Remembering them again is what makes them stick.</p>
      <ReviewSession />
    </main>
  );
}
