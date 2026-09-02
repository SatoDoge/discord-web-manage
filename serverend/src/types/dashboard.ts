export type DashboardKpi = {
  totalMembers: number;
  onlineMembers: number;
  todayJoins: number;
};

export type DashboardJoinTrendPoint = {
  date: string;
  joins: number;
  filteredJoins: number;
};

export type DashboardMessageFilterSummary = {
  todayFiltered: number;
  weekFiltered: number;
  pending: number;
  byType: {
    word: number;
    dupli: number;
    moderation: number;
  };
};

export type DashboardMemberJoinFilterSummary = {
  todayFiltered: number;
  weekFiltered: number;
  pending: number;
  byType: {
    name: number;
    joinDelay: number;
    profileModeration: number;
  };
};

export type DashboardFilterSummary = {
  message: DashboardMessageFilterSummary;
  memberJoin: DashboardMemberJoinFilterSummary;
};

export type DashboardActivityType =
  | 'operation_log'
  | 'message_filter'
  | 'member_join_filter';

export type DashboardActivityItem = {
  id: string;
  type: DashboardActivityType;
  occurredAt: string;
  title: string;
  summary: string;
  success?: boolean;
  route: string;
};

export type DashboardSummary = {
  kpi: DashboardKpi;
  joinTrend: DashboardJoinTrendPoint[];
  filterSummary: DashboardFilterSummary;
  recentActivity: DashboardActivityItem[];
};
