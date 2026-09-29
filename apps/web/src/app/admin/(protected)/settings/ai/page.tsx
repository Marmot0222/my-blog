import { settingsSummary } from "@ting-lab/publishing";
import { requireAdmin } from "@/lib/admin/auth";
import { AiSettings } from "@/components/admin/AiSettings";
export default async function AiSettingsPage() {
  await requireAdmin();
  return <AiSettings initial={await settingsSummary()} />;
}
