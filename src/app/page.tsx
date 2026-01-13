import { SubmissionForm } from "@/components/SubmissionForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-red-600">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <SubmissionForm />
      </div>
    </div>
  );
}
