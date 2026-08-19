import { notFound, redirect } from "next/navigation";
import ProjectWorkspace from "@/components/ProjectWorkspace";
import { currentUserId } from "@/lib/auth";
import { getBlock } from "@/lib/blocks";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const project = getBlock(userId, id);
  if (!project || project.kind !== "project") notFound();

  return <ProjectWorkspace initial={project} />;
}
