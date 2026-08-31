export interface OperatorRestaurant {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
  dayCutoffTime: string;
  pendingDayCutoffTime: string | null;
  pendingCutoffEffectiveAt: string | null;
}
