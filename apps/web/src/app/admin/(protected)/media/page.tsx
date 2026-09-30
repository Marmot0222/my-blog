import { requireAdmin } from "@/lib/admin/auth";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
export const dynamic = "force-dynamic";
export default async function MediaPage() {
  await requireAdmin();
  return (
    <>
      <h1>媒体库</h1>
      <MediaLibrary />
    </>
  );
}
