export interface Kpis {
  entities: number;
  transactions: number;
  rings_detected: number;
  entities_flagged: number;
  amount_at_risk_inr: number;
  cross_jurisdiction_rings: number;
}

export interface RingSummary {
  ring_id: string;
  ringleader: string;
  ringleader_name: string;
  size: number;
  n_mules: number;
  total_flow_inr: number;
  districts: string[];
  states: string[];
  cross_jurisdiction: boolean;
  risk: number;
  first_detectable: string | null;
  victims_after_detectable: number;
  n_victims: number;
}

export interface GraphNode {
  id: string;
  name: string;
  role: string;
  risk: number;
  band: string;
  district: string;
  lat: number;
  lng: number;
  is_leader: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  ts: string;
}

export interface RingDetail extends RingSummary {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Hotspot {
  district: string;
  lat: number;
  lng: number;
  flagged: number;
  total: number;
  loss_inr: number;
}

export interface GeoResponse {
  hotspots: Hotspot[];
  clusters: { cluster: number; size: number; districts: string[]; lat: number; lng: number }[];
}

export interface EntityDetail {
  person_id: string;
  name: string;
  role: string;
  district: string;
  state: string;
  scores: {
    rule_score: number;
    anomaly_score: number;
    ml_score: number;
    fused_score: number;
    risk_band: string;
  };
  reasons: string[];
  features: Record<string, number>;
  ring_id: string | null;
  accounts: string[];
}

export interface AgentResponse {
  answer: string;
  tool_calls: string[];
}

export interface PackageResponse {
  seq: number;
  this_hash: string;
  prev_hash: string;
  created_at: string;
  package: any;
}
