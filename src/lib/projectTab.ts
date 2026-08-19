/**
 * Each project has its own board, kept on a tab of its own: `project:<id>`. Client and
 * server both need these, so they live away from the database module.
 */
export function mapTabFor(projectId: string): string {
  return `project:${projectId}`;
}

export function projectIdOfTab(tab: string): string | null {
  return tab.startsWith("project:") ? tab.slice("project:".length) : null;
}
