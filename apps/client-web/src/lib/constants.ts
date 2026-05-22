/**
 * Shared constants with Backend
 * Must match _DROPDOWN in apps/api-server/app/services/ingestion_service.py
 */

export const AVAILABLE_TOPICS = [
  "General Python Programming",
  "Low-Level & Assembly",
  "General C/C++ Programming",
  "Software Architecture",
  "DevOps Deployment Guides",
  "Infrastructure as Code",
  "System Logs & Monitoring",
  "API Specifications",
  "Data Structures & Schemas",
  "Project Management & Agile",
  "Project Technical Documentation",
  "Deep Learning",
  "Frontend Programming",
  "Backend Programming",
  "AI Agent",
] as const;

export type TopicType = typeof AVAILABLE_TOPICS[number];
