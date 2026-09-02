/** Identifies the authenticated admin who initiated a service call from HTTP routes. */
export type AuthenticatedServiceContext = {
  actorUserId: string;
};
