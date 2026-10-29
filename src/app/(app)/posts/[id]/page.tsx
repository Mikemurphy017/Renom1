import { PageContainer } from "@/components/shared/page";
import { PostComposer } from "@/components/posts/post-composer";

export const metadata = { title: "Post" };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageContainer className="pt-8">
      <PostComposer id={(await params).id} />
    </PageContainer>
  );
}
