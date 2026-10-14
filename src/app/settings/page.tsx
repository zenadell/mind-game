import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <main>
      <h1>⚙️ Settings</h1>
      <p className="big">
        Choose which AI teaches you. Any provider works: pick one, paste your API key, load its models, and press Test.
      </p>
      <SettingsForm />
    </main>
  );
}
