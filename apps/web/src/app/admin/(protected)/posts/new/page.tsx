import { PostEditor } from "@/components/admin/PostEditor";
import { requireAdmin } from "@/lib/admin/auth";
export default async function NewPost() {
  await requireAdmin();
  return <PostEditor />;
}
