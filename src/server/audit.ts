import "server-only";
import { db, schema } from "@/db";

type Tx = Pick<typeof db, "insert">;

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  tx: Tx = db,
) {
  await tx.insert(schema.auditLogs).values({ actorId, action, entityType, entityId, metadata });
}
