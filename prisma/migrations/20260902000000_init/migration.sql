-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('WASTE_COLLECTION', 'STREET_CLEANING', 'CONTAINERS', 'TREES', 'GREEN_SPACES', 'ENVIRONMENTAL_CONTROL');

-- CreateEnum
CREATE TYPE "ServiceMode" AS ENUM ('ROUTE', 'POINT');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS', 'SUSPENDED', 'COMPLETED', 'PARTIALLY_COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceOrigin" AS ENUM ('PLANNED', 'TICKET', 'WEATHER_ALERT', 'INSPECTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "ZoneResultStatus" AS ENUM ('SERVICED', 'PARTIAL', 'NOT_SERVICED');

-- CreateEnum
CREATE TYPE "NotServicedReason" AS ENUM ('VEHICLE_BREAKDOWN', 'CREW_UNAVAILABLE', 'BLOCKED_ACCESS', 'STREET_CLOSURE', 'WEATHER', 'EXCESS_VOLUME', 'SECURITY_INCIDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "WasteType" AS ENUM ('HOUSEHOLD', 'RECYCLABLE', 'BULKY', 'GREEN', 'MIXED');

-- CreateEnum
CREATE TYPE "DisposalSiteType" AS ENUM ('LANDFILL', 'TRANSFER_STATION', 'RECYCLING_PLANT', 'COMPOSTING_PLANT');

-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('HOUSEHOLD', 'RECYCLABLE', 'BULKY', 'GREEN');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('ACTIVE', 'OVERFLOWED', 'DAMAGED', 'UNDER_REPAIR', 'RELOCATING', 'REMOVED');

-- CreateEnum
CREATE TYPE "DamageType" AS ENUM ('STRUCTURAL', 'BURNT', 'LID_BROKEN', 'WHEELS_BROKEN', 'VANDALIZED', 'MISSING');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TreeHealthStatus" AS ENUM ('HEALTHY', 'WEAKENED', 'DISEASED', 'DEAD');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskType" AS ENUM ('FALLING_BRANCH', 'TRUNK_INSTABILITY', 'ROOT_UPLIFT', 'POWER_LINE_CONTACT', 'SIGN_OBSTRUCTION', 'PEST_INFESTATION');

-- CreateEnum
CREATE TYPE "TreeInterventionType" AS ENUM ('FORMATION_PRUNING', 'SAFETY_PRUNING', 'REMOVAL', 'PLANTING', 'TREATMENT');

-- CreateEnum
CREATE TYPE "TreeInterventionStatus" AS ENUM ('REQUESTED', 'PENDING_AUTHORIZATION', 'AUTHORIZED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GreenSpaceType" AS ENUM ('SQUARE', 'PARK', 'PLANTER', 'MEDIAN', 'PROMENADE');

-- CreateEnum
CREATE TYPE "EnvironmentalReportType" AS ENUM ('NOISE', 'DUMPING', 'ILLEGAL_DUMPSITE', 'WATER_DISCHARGE', 'AIR_EMISSION', 'ODOR', 'PEST_INFESTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EnvironmentalReportStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'FORWARDED', 'DISMISSED', 'INSPECTION_SCHEDULED', 'INSPECTED', 'NO_VIOLATION', 'VIOLATION_FOUND', 'NOTICE_ISSUED', 'SANCTIONED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InspectionOutcome" AS ENUM ('NO_VIOLATION', 'VIOLATION_FOUND', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "InspectionNextStep" AS ENUM ('NOTICE_TO_BE_ISSUED', 'REINSPECTION', 'CASE_CLOSED');

-- CreateEnum
CREATE TYPE "ViolationType" AS ENUM ('NOISE_LIMIT', 'ILLEGAL_DUMPING', 'UNTREATED_DISCHARGE', 'HAZARDOUS_WASTE', 'AIR_EMISSION', 'NO_WASTE_MANAGEMENT', 'INSPECTION_OBSTRUCTION');

-- CreateEnum
CREATE TYPE "SuggestedAction" AS ENUM ('WARNING', 'FORMAL_NOTICE', 'FINE', 'CLOSURE');

-- CreateEnum
CREATE TYPE "SanctionDecision" AS ENUM ('FINE_ISSUED', 'CLOSURE_ORDERED', 'FORMAL_NOTICE_ISSUED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CrewType" AS ENUM ('MUNICIPAL', 'COOPERATIVE', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('COMPACTOR_TRUCK', 'DUMP_TRUCK', 'SWEEPER', 'WATER_TANKER', 'CRANE_TRUCK', 'VAN');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- CreateEnum
CREATE TYPE "RepairDamageType" AS ENUM ('BROKEN_PAVEMENT', 'BROKEN_SIDEWALK', 'BROKEN_STREETLIGHT', 'BLOCKED_DRAIN', 'DAMAGED_STRUCTURE');

-- CreateEnum
CREATE TYPE "StreetClosureType" AS ENUM ('TOTAL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "DelayType" AS ENUM ('START', 'DURATION');

-- CreateEnum
CREATE TYPE "RepairRequestStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "StreetClosureRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ENDED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "service_type" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "mode" "ServiceMode" NOT NULL,
    "requires_vehicle" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_neighborhood" (
    "zone_id" UUID NOT NULL,
    "neighborhood_id" TEXT NOT NULL,

    CONSTRAINT "zone_neighborhood_pkey" PRIMARY KEY ("zone_id","neighborhood_id")
);

-- CreateTable
CREATE TABLE "route" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stop" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "estimated_duration_min" INTEGER NOT NULL,

    CONSTRAINT "route_stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_frequency" (
    "id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "shift" "Shift" NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_frequency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequency_weekday" (
    "frequency_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,

    CONSTRAINT "frequency_weekday_pkey" PRIMARY KEY ("frequency_id","weekday")
);

-- CreateTable
CREATE TABLE "crew" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "crew_type" "CrewType" NOT NULL,
    "leader_user_id" TEXT,
    "organization_id" TEXT,
    "default_shift" "Shift" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_member" (
    "crew_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "crew_member_pkey" PRIMARY KEY ("crew_id","user_id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" UUID NOT NULL,
    "plate" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "capacity" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "mode" "ServiceMode" NOT NULL,
    "route_id" UUID,
    "target_type" TEXT,
    "target_id" UUID,
    "scheduled_date" DATE NOT NULL,
    "window_from" TIME,
    "window_to" TIME,
    "crew_id" UUID,
    "vehicle_id" UUID,
    "status" "ServiceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "status_reason" TEXT,
    "origin" "ServiceOrigin" NOT NULL,
    "ticket_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_zone" (
    "service_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "service_zone_pkey" PRIMARY KEY ("service_id","zone_id")
);

-- CreateTable
CREATE TABLE "zone_result" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "status" "ZoneResultStatus" NOT NULL,
    "reason" "NotServicedReason",
    "proposed_date" DATE,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_record" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "zone_result_id" UUID,
    "disposal_site_id" UUID NOT NULL,
    "waste_type" "WasteType" NOT NULL,
    "volume_m3" DECIMAL(10,2),
    "weight_kg" DECIMAL(10,2),

    CONSTRAINT "collection_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposal_site" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "site_type" "DisposalSiteType" NOT NULL,

    CONSTRAINT "disposal_site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" UUID NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "container_type" "ContainerType" NOT NULL,
    "zone_id" UUID NOT NULL,
    "address" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "capacity_liters" INTEGER NOT NULL,
    "status" "ContainerStatus" NOT NULL DEFAULT 'ACTIVE',
    "damage_type" "DamageType",
    "severity" "Severity",
    "requires_public_works" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "green_point" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone_id" UUID NOT NULL,
    "address" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "green_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "green_point_waste_type" (
    "green_point_id" UUID NOT NULL,
    "waste_type" "WasteType" NOT NULL,

    CONSTRAINT "green_point_waste_type_pkey" PRIMARY KEY ("green_point_id","waste_type")
);

-- CreateTable
CREATE TABLE "tree" (
    "id" UUID NOT NULL,
    "survey_code" TEXT NOT NULL,
    "species" TEXT,
    "zone_id" UUID NOT NULL,
    "address" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "height_m" DECIMAL(5,2),
    "diameter_cm" DECIMAL(5,1),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_survey" (
    "id" UUID NOT NULL,
    "tree_id" UUID NOT NULL,
    "surveyed_at" TIMESTAMP(3) NOT NULL,
    "inspector_id" TEXT,
    "health_status" "TreeHealthStatus" NOT NULL,
    "risk_level" "RiskLevel" NOT NULL,
    "risk_type" "RiskType",
    "suggested_intervention" "TreeInterventionType",
    "requires_street_closure" BOOLEAN NOT NULL DEFAULT false,
    "requires_public_works" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_intervention" (
    "id" UUID NOT NULL,
    "intervention_type" "TreeInterventionType" NOT NULL,
    "service_id" UUID,
    "address" TEXT,
    "requires_street_closure" BOOLEAN NOT NULL DEFAULT false,
    "status" "TreeInterventionStatus" NOT NULL,
    "priority" "Severity",
    "authorized_by_user_id" TEXT,
    "authorized_at" TIMESTAMP(3),
    "justification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tree_intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_tree" (
    "intervention_id" UUID NOT NULL,
    "tree_id" UUID NOT NULL,

    CONSTRAINT "intervention_tree_pkey" PRIMARY KEY ("intervention_id","tree_id")
);

-- CreateTable
CREATE TABLE "green_space" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "space_type" "GreenSpaceType" NOT NULL,
    "zone_id" UUID NOT NULL,
    "area_m2" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "green_space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmental_report" (
    "id" UUID NOT NULL,
    "report_type" "EnvironmentalReportType" NOT NULL,
    "address" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "ticket_id" TEXT,
    "reporter_snapshot" JSONB,
    "status" "EnvironmentalReportStatus" NOT NULL DEFAULT 'RECEIVED',
    "priority" "Severity",
    "deadline_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environmental_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmental_inspection" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "service_id" UUID,
    "inspector_id" TEXT,
    "inspected_at" TIMESTAMP(3),
    "findings" TEXT,
    "outcome" "InspectionOutcome",
    "next_step" "InspectionNextStep",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environmental_inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "item_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "result" BOOLEAN NOT NULL,
    "observations" TEXT,

    CONSTRAINT "checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_notice" (
    "id" UUID NOT NULL,
    "notice_number" TEXT NOT NULL,
    "inspection_id" UUID NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "establishment_id" TEXT,
    "violation_type" "ViolationType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "suggested_action" "SuggestedAction" NOT NULL,
    "prior_notice_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violation_notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanction_outcome" (
    "id" UUID NOT NULL,
    "violation_notice_id" UUID NOT NULL,
    "decision" "SanctionDecision" NOT NULL,
    "decided_at" TIMESTAMP(3),
    "external_ref" TEXT,
    "dismissal_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sanction_outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_request" (
    "id" UUID NOT NULL,
    "damage_type" "RepairDamageType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "address" TEXT,
    "detected_in_type" TEXT NOT NULL,
    "detected_in_id" UUID NOT NULL,
    "status" "RepairRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "work_order_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "street_closure_request" (
    "id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "closure_type" "StreetClosureType",
    "closure_from" TIMESTAMP(3),
    "closure_to" TIMESTAMP(3),
    "status" "StreetClosureRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "closure_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "street_closure_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_street" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "street_name" TEXT NOT NULL,
    "from_cross" TEXT NOT NULL,
    "to_cross" TEXT NOT NULL,

    CONSTRAINT "closure_street_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_event" (
    "id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "inbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_type_code_key" ON "service_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "zone_code_key" ON "zone"("code");

-- CreateIndex
CREATE INDEX "zone_neighborhood_neighborhood_id_idx" ON "zone_neighborhood"("neighborhood_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_code_key" ON "route"("code");

-- CreateIndex
CREATE UNIQUE INDEX "route_stop_route_id_sequence_key" ON "route_stop"("route_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_plate_key" ON "vehicle"("plate");

-- CreateIndex
CREATE INDEX "service_status_idx" ON "service"("status");

-- CreateIndex
CREATE INDEX "service_scheduled_date_idx" ON "service"("scheduled_date");

-- CreateIndex
CREATE INDEX "service_ticket_id_idx" ON "service"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_result_service_id_zone_id_key" ON "zone_result"("service_id", "zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "disposal_site_code_key" ON "disposal_site"("code");

-- CreateIndex
CREATE INDEX "attachment_owner_type_owner_id_idx" ON "attachment"("owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "container_code_key" ON "container"("code");

-- CreateIndex
CREATE INDEX "container_status_idx" ON "container"("status");

-- CreateIndex
CREATE UNIQUE INDEX "green_point_code_key" ON "green_point"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tree_survey_code_key" ON "tree"("survey_code");

-- CreateIndex
CREATE UNIQUE INDEX "tree_intervention_service_id_key" ON "tree_intervention"("service_id");

-- CreateIndex
CREATE INDEX "environmental_report_status_idx" ON "environmental_report"("status");

-- CreateIndex
CREATE INDEX "environmental_report_ticket_id_idx" ON "environmental_report"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "environmental_inspection_service_id_key" ON "environmental_inspection"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "violation_notice_notice_number_key" ON "violation_notice"("notice_number");

-- CreateIndex
CREATE UNIQUE INDEX "violation_notice_inspection_id_key" ON "violation_notice"("inspection_id");

-- CreateIndex
CREATE UNIQUE INDEX "sanction_outcome_violation_notice_id_key" ON "sanction_outcome"("violation_notice_id");

-- CreateIndex
CREATE INDEX "repair_request_status_idx" ON "repair_request"("status");

-- CreateIndex
CREATE INDEX "street_closure_request_status_idx" ON "street_closure_request"("status");

-- CreateIndex
CREATE INDEX "outbox_event_status_idx" ON "outbox_event"("status");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_event_message_id_key" ON "inbox_event"("message_id");

-- AddForeignKey
ALTER TABLE "zone_neighborhood" ADD CONSTRAINT "zone_neighborhood_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stop" ADD CONSTRAINT "route_stop_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stop" ADD CONSTRAINT "route_stop_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_frequency" ADD CONSTRAINT "service_frequency_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_frequency" ADD CONSTRAINT "service_frequency_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequency_weekday" ADD CONSTRAINT "frequency_weekday_frequency_id_fkey" FOREIGN KEY ("frequency_id") REFERENCES "service_frequency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member" ADD CONSTRAINT "crew_member_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_zone" ADD CONSTRAINT "service_zone_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_zone" ADD CONSTRAINT "service_zone_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_result" ADD CONSTRAINT "zone_result_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_result" ADD CONSTRAINT "zone_result_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_record" ADD CONSTRAINT "collection_record_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_record" ADD CONSTRAINT "collection_record_zone_result_id_fkey" FOREIGN KEY ("zone_result_id") REFERENCES "zone_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_record" ADD CONSTRAINT "collection_record_disposal_site_id_fkey" FOREIGN KEY ("disposal_site_id") REFERENCES "disposal_site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container" ADD CONSTRAINT "container_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "green_point" ADD CONSTRAINT "green_point_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "green_point_waste_type" ADD CONSTRAINT "green_point_waste_type_green_point_id_fkey" FOREIGN KEY ("green_point_id") REFERENCES "green_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree" ADD CONSTRAINT "tree_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_survey" ADD CONSTRAINT "tree_survey_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "tree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_intervention" ADD CONSTRAINT "tree_intervention_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervention_tree" ADD CONSTRAINT "intervention_tree_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "tree_intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervention_tree" ADD CONSTRAINT "intervention_tree_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "tree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "green_space" ADD CONSTRAINT "green_space_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_inspection" ADD CONSTRAINT "environmental_inspection_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "environmental_report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_inspection" ADD CONSTRAINT "environmental_inspection_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "environmental_inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_notice" ADD CONSTRAINT "violation_notice_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "environmental_inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanction_outcome" ADD CONSTRAINT "sanction_outcome_violation_notice_id_fkey" FOREIGN KEY ("violation_notice_id") REFERENCES "violation_notice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_street" ADD CONSTRAINT "closure_street_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "street_closure_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

