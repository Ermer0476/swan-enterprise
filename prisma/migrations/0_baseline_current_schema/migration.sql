-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DepartmentType" AS ENUM ('EXECUTIVE', 'MARINE', 'TECHNICAL', 'OPERATIONS', 'CREWING', 'PURCHASING', 'ACCOUNTING', 'ADMIN', 'HR', 'IT', 'QHSE', 'SHIPBOARD');

-- CreateEnum
CREATE TYPE "VesselStatus" AS ENUM ('ACTIVE', 'LAID_UP', 'DRYDOCK', 'SOLD');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'SUBMIT', 'LOGIN', 'LOGOUT', 'SYNC', 'UPLOAD', 'DOWNLOAD', 'PRINT', 'EXPORT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'APPROVAL_REQUEST', 'APPROVAL_RESULT', 'MENTION', 'ASSIGNMENT', 'DEADLINE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApproverType" AS ENUM ('ROLE', 'DEPARTMENT', 'SPECIFIC_USER');

-- CreateEnum
CREATE TYPE "WorkflowDecision" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('PERSONAL_INJURY', 'OCCUPATIONAL_ILLNESS', 'ENVIRONMENTAL', 'PROPERTY_EQUIPMENT_DAMAGE', 'LOSS_OF_CONTAINMENT', 'FIRE_EXPLOSION', 'NAVIGATION_MARINE', 'CARGO_OPERATION', 'MOORING_OPERATION', 'SECURITY', 'CYBER_SECURITY', 'REGULATORY_COMPLIANCE', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('DRAFT', 'REPORTED', 'UNDER_INVESTIGATION', 'ACTION_PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "RootCauseCategory" AS ENUM ('PROCESS_METHODS', 'HUMAN_FACTORS', 'EQUIPMENT_SOFTWARE', 'MATERIALS', 'MEASUREMENT_INFORMATION', 'ENVIRONMENT_WORK_CONDITIONS', 'MANAGEMENT_GOVERNANCE');

-- CreateEnum
CREATE TYPE "CapaKind" AS ENUM ('CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NearMissStatus" AS ENUM ('DRAFT', 'REPORTED', 'UNDER_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "NearMissConsequenceType" AS ENUM ('INJURY_ILL_HEALTH', 'ENVIRONMENTAL_DAMAGE', 'PROPERTY_DAMAGE', 'FIRE_EXPLOSION', 'LOSS_OF_CONTAINMENT', 'NAVIGATION_MARINE_INCIDENT', 'SECURITY', 'REGULATORY');

-- CreateEnum
CREATE TYPE "NearMissKind" AS ENUM ('NEAR_MISS', 'HOR');

-- CreateEnum
CREATE TYPE "HazardType" AS ENUM ('UNSAFE_ACT', 'UNSAFE_CONDITION');

-- CreateEnum
CREATE TYPE "NcrSource" AS ENUM ('INTERNAL_AUDIT', 'EXTERNAL_AUDIT', 'PSC', 'SIRE', 'CDI', 'VETTING', 'FLAG_STATE', 'OTHER');

-- CreateEnum
CREATE TYPE "NcrStatus" AS ENUM ('DRAFT', 'OPEN', 'SUBMITTED_TO_OFFICE', 'CLOSED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "InternalAuditStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DrillStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SireInspectionType" AS ENUM ('LOADING_OPERATION', 'DISCHARGING_OPERATION', 'BUNKERING', 'IDLE');

-- CreateEnum
CREATE TYPE "SireOverallResult" AS ENUM ('SATISFACTORY', 'OBSERVATIONS', 'MAJOR_CONCERN');

-- CreateEnum
CREATE TYPE "CompanyInspectionType" AS ENUM ('TECHNICAL', 'SAFETY');

-- CreateEnum
CREATE TYPE "CompanyInspectionVisitKind" AS ENUM ('PORT_VISIT', 'SAILING_VISIT');

-- CreateEnum
CREATE TYPE "SireObservationStatus" AS ENUM ('OPEN', 'ONGOING', 'PENDING_VERIFICATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "SireObservationCategory" AS ENUM ('HARDWARE', 'PROCESS', 'HUMAN', 'PHOTOGRAPH');

-- CreateEnum
CREATE TYPE "CdiObservationSection" AS ENUM ('SECTION_1', 'SECTION_2', 'SECTION_3', 'SECTION_4', 'SECTION_5LP', 'SECTION_6', 'SECTION_7', 'SECTION_8', 'SECTION_9', 'SECTION_10', 'SECTION_11', 'SECTION_12', 'SECTION_13', 'SECTION_14');

-- CreateEnum
CREATE TYPE "AuditFindingCategory" AS ENUM ('MAJOR_NC', 'MINOR_NC', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "ExposureEnteredBy" AS ENUM ('VESSEL', 'OFFICE');

-- CreateEnum
CREATE TYPE "InjuryClassification" AS ENUM ('FAC', 'MTC', 'RWC', 'LWC', 'PPD', 'PTD', 'FAT');

-- CreateEnum
CREATE TYPE "CommitteeType" AS ENUM ('SAFETY', 'MAINTENANCE', 'HEALTH_HYGIENE', 'SHIPBOARD_MANAGEMENT_TEAM', 'OTHERS');

-- CreateEnum
CREATE TYPE "CommitteeMeetingStatus" AS ENUM ('DRAFT', 'REPORTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ScheduleItemKind" AS ENUM ('DRILL', 'FAMILIARIZATION');

-- CreateEnum
CREATE TYPE "LsaFfeCategory" AS ENUM ('LSA', 'FFE');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('FORM', 'CHECKLIST', 'CERTIFICATE', 'MANUAL', 'PROCEDURE', 'OTHER');

-- CreateEnum
CREATE TYPE "ControlledDocStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CircularSource" AS ENUM ('FLAG', 'CLASS', 'INSURANCE', 'COMPANY');

-- CreateEnum
CREATE TYPE "CircularCategory" AS ENUM ('SAFETY', 'TECHNICAL', 'NAVIGATIONAL', 'SECURITY', 'ENVIRONMENTAL', 'SAFETY_CAMPAIGN', 'HEALTH_HYGIENE', 'OPERATIONAL', 'HR', 'REGULATORY', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewTrigger" AS ENUM ('ANNUAL_REVIEW_DUE', 'REVIEW_PERIOD_EXPIRED', 'REVISION_REQUESTED_BY_VESSEL', 'INCIDENT_INVESTIGATION_RECOMMENDATION', 'NEAR_MISS_RECOMMENDATION', 'HAZARD_OBSERVATION_RECOMMENDATION', 'SIRE_OBSERVATION', 'PSC_DEFICIENCY', 'INTERNAL_AUDIT_FINDING', 'EXTERNAL_AUDIT_FINDING', 'SMS_PROCEDURE_REVISED', 'MANAGEMENT_REQUEST', 'REGULATORY_CHANGE');

-- CreateEnum
CREATE TYPE "RaExecutionCondition" AS ENUM ('UNCHANGED', 'CHANGED');

-- CreateEnum
CREATE TYPE "RaRevisionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RaApprovalLevel" AS ENUM ('LOCAL', 'COMPANY_MANDATORY');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('OPEN', 'MONITORING', 'RECTIFIED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "VoyageReportType" AS ENUM ('DEPARTURE', 'ARRIVAL', 'NOON_AT_SEA', 'IN_PORT');

-- CreateEnum
CREATE TYPE "VesselTrackerStatus" AS ENUM ('SAILING', 'DRIFTING', 'SHELTERING', 'ANCHORING', 'IN_PORT');

-- CreateEnum
CREATE TYPE "VesselLadenState" AS ENUM ('LADEN', 'BALLAST');

-- CreateEnum
CREATE TYPE "EngineOrder" AS ENUM ('NORMAL_STEAMING', 'SLOW_STEAMING', 'SUPER_SLOW_STEAMING', 'FAST_STEAMING');

-- CreateEnum
CREATE TYPE "BunkerGrade" AS ENUM ('HSFO', 'LSFO', 'HSDO', 'LSDO', 'HSGO', 'LSGO', 'CYL_OIL', 'MELO', 'GELO', 'FRESH_WATER', 'FRESH_WATER_PRODUCTION');

-- CreateEnum
CREATE TYPE "GarbageCategory" AS ENUM ('PLASTICS', 'FOOD_WASTES', 'DOMESTIC_WASTES', 'COOKING_OIL', 'INCINERATOR_ASHES', 'OPERATIONAL_WASTES', 'ANIMAL_CARCASSES', 'FISHING_GEAR', 'E_WASTE');

-- CreateEnum
CREATE TYPE "UnitMasterMetric" AS ENUM ('SEWAGE', 'CARGO');

-- CreateEnum
CREATE TYPE "TmsaComplianceStatus" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "TmsaResponseState" AS ENUM ('ON_OCIMF', 'REVISED');

-- CreateEnum
CREATE TYPE "TmsaFindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "StoresCategory" AS ENUM ('DECK', 'ENGINE', 'TOOLS', 'GALLEY', 'STATIONERY', 'PAINTS', 'CHEMICALS', 'MEDICINE', 'PROVISIONS', 'SAFETY', 'FIREFIGHTING', 'BOOKS_CHARTS', 'NAVIGATION', 'PORTABLE_RADIOS', 'IMO_STICKERS');

-- CreateEnum
CREATE TYPE "RequisitionDepartment" AS ENUM ('DECK', 'ENGINE');

-- CreateEnum
CREATE TYPE "RequisitionCategory" AS ENUM ('DECK', 'ENGINE', 'TOOLS', 'GALLEY', 'STATIONERY', 'PAINTS', 'CHEMICALS', 'MEDICINE', 'PROVISIONS', 'SAFETY', 'FIREFIGHTING', 'BOOKS_CHARTS', 'NAVIGATION', 'PORTABLE_RADIOS', 'IMO_STICKERS', 'SPARES');

-- CreateEnum
CREATE TYPE "StockTakeStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('STORES', 'SPARES');

-- CreateEnum
CREATE TYPE "InventoryEventType" AS ENUM ('OPENING', 'ISSUED', 'RECEIVED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryCondition" AS ENUM ('NEW', 'USABLE', 'RECONDITIONED');

-- CreateEnum
CREATE TYPE "InventoryUpdateStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "RequisitionRevisionStatus" AS ENUM ('DRAFT', 'PENDING_MASTER_APPROVAL', 'APPROVED_BY_MASTER', 'SENT_TO_OFFICE', 'FOR_QUOTATION', 'FOR_DELIVERY', 'RECEIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RequisitionLineItemType" AS ENUM ('STORES', 'SPARES', 'NON_CATALOGUE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ltifTarget" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "trcfTarget" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "sireAvgObservationTarget" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "cinspAvgObservationTarget" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "procurementThresholdSupt" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "procurementThresholdTechManager" DOUBLE PRECISION NOT NULL DEFAULT 500000,
    "documentExpiryWarningMonths" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "department" "DepartmentType" NOT NULL,
    "rank" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "vesselId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Vessel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "imo" TEXT,
    "officialNumber" TEXT,
    "callSign" TEXT,
    "mmsi" TEXT,
    "flag" TEXT,
    "type" TEXT NOT NULL DEFAULT 'LPG Carrier',
    "classificationSociety" TEXT,
    "yearBuilt" INTEGER,
    "grossTonnage" DOUBLE PRECISION,
    "loa" DOUBLE PRECISION,
    "breadth" DOUBLE PRECISION,
    "depth" DOUBLE PRECISION,
    "status" "VesselStatus" NOT NULL DEFAULT 'ACTIVE',
    "capacityCbm" DOUBLE PRECISION,
    "netTonnage" DOUBLE PRECISION,
    "deadweight" DOUBLE PRECISION,
    "tradeArea" TEXT,
    "registeredOwner" TEXT,
    "headOwner" TEXT,
    "charterer" TEXT,
    "yearWithSwan" INTEGER,
    "lastDryDock" TIMESTAMP(3),
    "dryDockPlace" TEXT,
    "nextDryDockDue" TIMESTAMP(3),
    "portOfRegistry" TEXT,
    "lbp" DOUBLE PRECISION,
    "draft" DOUBLE PRECISION,
    "mainEngine" TEXT,
    "serviceSpeed" DOUBLE PRECISION,
    "stdFoConsumptionMt" DOUBLE PRECISION,
    "stdDoConsumptionMt" DOUBLE PRECISION,
    "navigationArea" TEXT,
    "classNotation" TEXT,
    "ownerAddress" TEXT,
    "builder" TEXT,
    "keelLaidDate" TIMESTAMP(3),
    "launchingDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "totalComplement" INTEGER,
    "satPhone" TEXT,
    "vesselEmail" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Vessel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetOpex" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "subItem" TEXT,
    "budgetAllocated" DOUBLE PRECISION NOT NULL,
    "actualCost" DOUBLE PRECISION NOT NULL,
    "variance" DOUBLE PRECISION NOT NULL,
    "days" DOUBLE PRECISION,
    "qty" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "rob" DOUBLE PRECISION,
    "orderQty" DOUBLE PRECISION,
    "expiry" TEXT,
    "basis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "BudgetOpex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "color" TEXT NOT NULL DEFAULT 'sky',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetSchedule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselName" TEXT NOT NULL,
    "vesselId" TEXT,
    "sortOrder" INTEGER,
    "status" TEXT,
    "submitToMgt" TEXT,
    "submitToOwners" TEXT,
    "budgetStatus" TEXT NOT NULL DEFAULT 'Pending',
    "contractFrom" TIMESTAMP(3),
    "contractTo" TIMESTAMP(3),
    "nextContractFrom" TIMESTAMP(3),
    "nextContractTo" TIMESTAMP(3),
    "bfa" TEXT,
    "remarks" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaAction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" "CapaKind" NOT NULL,
    "code" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "responsible" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "closedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "CapaAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverType" "ApproverType" NOT NULL,
    "approverRole" TEXT,
    "approverDept" "DepartmentType",
    "approverUser" TEXT,
    "slaHours" INTEGER,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'DRAFT',
    "currentOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAction" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "decision" "WorkflowDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "department" "DepartmentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT,
    "vesselId" TEXT,
    "currentRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "SmsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsRevision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "changeSummary" TEXT,
    "content" TEXT,
    "fileKey" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "SmsRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT,
    "title" TEXT NOT NULL,
    "severity" "Severity",
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "vesselId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "investigationDetails" TEXT,
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "immediateAction" TEXT,
    "rootCause" TEXT,
    "closedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "reportedById" TEXT,
    "reporterName" TEXT,
    "reporterPosition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentSofEntry" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentSofEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentTypeEntry" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "subCategory" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentTypeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMiss" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT,
    "title" TEXT NOT NULL,
    "kind" "NearMissKind" NOT NULL DEFAULT 'NEAR_MISS',
    "horCategory" "HazardType",
    "stopAuthorityExercised" BOOLEAN NOT NULL DEFAULT false,
    "vesselId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "potentialConsequence" "NearMissConsequenceType" NOT NULL,
    "potentialSeverity" "Severity" NOT NULL,
    "immediateAction" TEXT,
    "rootCauseCategory" "RootCauseCategory" NOT NULL,
    "rootCauseSubCategory" TEXT,
    "status" "NearMissStatus" NOT NULL DEFAULT 'REPORTED',
    "closedAt" TIMESTAMP(3),
    "shoreRemarks" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reportedById" TEXT,
    "reporterName" TEXT,
    "reporterPosition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "NearMiss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConformity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT,
    "title" TEXT NOT NULL,
    "vesselId" TEXT,
    "source" "NcrSource" NOT NULL,
    "sourceEntityId" TEXT,
    "requirement" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL,
    "targetDate" TIMESTAMP(3),
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "rootCause" TEXT,
    "personInCharge" TEXT,
    "shoreRemarks" TEXT,
    "status" "NcrStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "raisedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "NonConformity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SireInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT,
    "inspectingCompany" TEXT NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "port" TEXT,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectionType" "SireInspectionType",
    "sireVersion" TEXT DEFAULT '2.0',
    "overallResult" "SireOverallResult",
    "summary" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "SireInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SireObservation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "chapter" INTEGER,
    "category" "SireObservationCategory",
    "viqRef" TEXT,
    "question" TEXT,
    "observation" TEXT NOT NULL,
    "immediateCause" TEXT,
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "preventiveMeasure" TEXT,
    "responsiblePersonId" TEXT,
    "targetDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "status" "SireObservationStatus" NOT NULL DEFAULT 'OPEN',
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SireObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SireObservationComment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SireObservationComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SireQuestionnaireVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "SireQuestionnaireVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SireQuestionnaireItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "no" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "shortText" TEXT,
    "personInCharge" TEXT,
    "smsProcRefs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SireQuestionnaireItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PscInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT,
    "authority" TEXT NOT NULL,
    "mouRegion" TEXT,
    "port" TEXT,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "detained" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "PscInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PscDeficiency" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "natureCode" TEXT,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "actionCode" TEXT,
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PscDeficiency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CdiInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT,
    "inspectorName" TEXT,
    "scheme" TEXT DEFAULT 'CDI-M',
    "port" TEXT,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "CdiInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CdiObservation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "questionRef" TEXT,
    "observation" TEXT NOT NULL,
    "response" TEXT,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "category" "CdiObservationSection",
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CdiObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT,
    "vesselId" TEXT,
    "scope" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "auditorName" TEXT,
    "auditBody" TEXT,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "status" "InternalAuditStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "InternalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAuditFinding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" "AuditFindingCategory" NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InternalAuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT,
    "scope" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "auditorName" TEXT,
    "auditBody" TEXT,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "ExternalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAuditFinding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" "AuditFindingCategory" NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalAuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT,
    "inspectionType" "CompanyInspectionType",
    "visitKind" "CompanyInspectionVisitKind",
    "inspectorName" TEXT,
    "port" TEXT,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "CompanyInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInspectionObservation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "chapter" INTEGER,
    "category" "SireObservationCategory",
    "viqRef" TEXT,
    "observation" TEXT NOT NULL,
    "immediateCause" TEXT,
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "rootCause" TEXT,
    "immediateCorrectiveAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyInspectionObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExposureCrewEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "crew" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "enteredBy" "ExposureEnteredBy" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "ExposureCrewEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExposureInjuryCase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "classification" "InjuryClassification" NOT NULL,
    "description" TEXT,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "ExposureInjuryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMeeting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT,
    "vesselId" TEXT,
    "position" TEXT,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "meetingTime" TEXT,
    "chairman" TEXT,
    "inCharge" TEXT,
    "members" TEXT,
    "inAttendance" TEXT,
    "forAcknowledgement" TEXT,
    "vesselRemarks" TEXT,
    "shoreRemarks" TEXT,
    "status" "CommitteeMeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "reportedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "revisedAfterReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "CommitteeMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMeetingAgenda" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "committeeType" "CommitteeType" NOT NULL,
    "code" TEXT,
    "label" TEXT NOT NULL,
    "details" TEXT,
    "shoreComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitteeMeetingAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "ScheduleItemKind" NOT NULL,
    "category" TEXT,
    "itemNo" TEXT,
    "name" TEXT NOT NULL,
    "smsReference" TEXT,
    "frequencyLabel" TEXT,
    "frequencyDays" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleApplicability" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "scheduleItemId" TEXT NOT NULL,
    "notApplicable" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ScheduleApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyDrill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT,
    "vesselId" TEXT NOT NULL,
    "scheduleItemId" TEXT NOT NULL,
    "drillDate" TIMESTAMP(3) NOT NULL,
    "drillTime" TEXT,
    "position" TEXT,
    "participants" TEXT,
    "conductedBy" TEXT,
    "details" TEXT,
    "deficiencies" TEXT,
    "correctiveAction" TEXT,
    "vesselRemarks" TEXT,
    "status" "DrillStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "EmergencyDrill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamiliarizationRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "scheduleItemId" TEXT NOT NULL,
    "completedDate" TIMESTAMP(3) NOT NULL,
    "notedBy" TEXT,
    "remarks" TEXT,
    "familiarizationSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "FamiliarizationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamiliarizationSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "notedBy" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "FamiliarizationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LsaFfeItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" "LsaFfeCategory" NOT NULL,
    "itemNo" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "suggestedWeek" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LsaFfeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewFamiliarization" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "week" INTEGER NOT NULL DEFAULT 1,
    "attendees" TEXT NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "supervisedBy" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "CrewFamiliarization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewFamiliarizationRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "crewFamiliarizationId" TEXT NOT NULL,
    "lsaFfeItemId" TEXT NOT NULL,
    "completedDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CrewFamiliarizationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlledDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "vesselId" TEXT,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "version" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "reviewDate" TIMESTAMP(3),
    "owner" TEXT,
    "description" TEXT,
    "status" "ControlledDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "ControlledDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VesselDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT,
    "type" TEXT NOT NULL,
    "refNo" TEXT,
    "name" TEXT NOT NULL,
    "issuingBody" TEXT,
    "certNo" TEXT,
    "interval" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiredDate" TIMESTAMP(3),
    "remarks" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "VesselDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circular" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT,
    "title" TEXT NOT NULL,
    "source" "CircularSource" NOT NULL,
    "issuingBody" TEXT,
    "category" "CircularCategory" NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dateReceived" TIMESTAMP(3),
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Circular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircularAcknowledgement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "circularId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientLabel" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "acknowledgedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircularAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessmentDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "vesselId" TEXT,
    "applicableVesselType" TEXT,
    "reviewFrequencyMonths" INTEGER NOT NULL DEFAULT 12,
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "reviewOwnerId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT,
    "currentRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "RiskAssessmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessmentRevision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "changeSummary" TEXT,
    "reviewTrigger" "ReviewTrigger",
    "smsProcedureRefs" TEXT,
    "riskMatrixRef" TEXT,
    "checklistsRequired" TEXT,
    "approvalLevel" "RaApprovalLevel" NOT NULL DEFAULT 'LOCAL',
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RiskAssessmentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskHazardRow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "phase" TEXT,
    "consequence" TEXT NOT NULL,
    "causes" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "existingControls" TEXT NOT NULL,
    "additionalControls" TEXT,
    "resLikelihood" INTEGER,
    "responsible" TEXT,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "ratingChangeNote" TEXT,
    "vesselId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RiskHazardRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessmentExecution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "conditionStatus" "RaExecutionCondition" NOT NULL DEFAULT 'UNCHANGED',
    "changedConditionsNote" TEXT,
    "temporaryHazards" TEXT,
    "temporaryControls" TEXT,
    "performedById" TEXT,
    "toolboxSignedAt" TIMESTAMP(3),
    "toolboxAttendees" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RiskAssessmentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessmentRevisionRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requestedById" TEXT,
    "vesselId" TEXT,
    "reason" TEXT NOT NULL,
    "reviewTrigger" "ReviewTrigger" NOT NULL DEFAULT 'REVISION_REQUESTED_BY_VESSEL',
    "status" "RaRevisionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessmentRevisionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Defect" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "DefectSeverity" NOT NULL,
    "dateRaised" TIMESTAMP(3) NOT NULL,
    "targetRectificationDate" TIMESTAMP(3),
    "actionTaken" TEXT,
    "raisedBy" TEXT,
    "status" "DefectStatus" NOT NULL DEFAULT 'OPEN',
    "rectifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoyageLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "voyageNo" TEXT,
    "reportType" "VoyageReportType" NOT NULL,
    "vesselStatus" "VesselTrackerStatus" NOT NULL,
    "ladenState" "VesselLadenState" NOT NULL,
    "engineOrder" "EngineOrder",
    "steamingTimeHrs" DOUBLE PRECISION,
    "obsSpeedKn" DOUBLE PRECISION,
    "meSpeedKn" DOUBLE PRECISION,
    "rpm" DOUBLE PRECISION,
    "slipPct" DOUBLE PRECISION,
    "beaufortScale" INTEGER,
    "portStayHrs" DOUBLE PRECISION,
    "totalPortStayHrs" DOUBLE PRECISION,
    "offHireHrs" DOUBLE PRECISION,
    "fromPort" TEXT,
    "nextPort" TEXT,
    "course" TEXT,
    "zoneDescription" TEXT,
    "reportTimeLocal" TEXT,
    "position" TEXT,
    "draftFwdM" DOUBLE PRECISION,
    "draftAftM" DOUBLE PRECISION,
    "draftMeanM" DOUBLE PRECISION,
    "distanceRunNm" DOUBLE PRECISION,
    "totalDistanceRunNm" DOUBLE PRECISION,
    "dtgNextPortNm" DOUBLE PRECISION,
    "totalSteamingTimeHrs" DOUBLE PRECISION,
    "distanceLogNm" DOUBLE PRECISION,
    "generalAvgSpeedKn" DOUBLE PRECISION,
    "engineDistanceNm" DOUBLE PRECISION,
    "totalEngineDistanceNm" DOUBLE PRECISION,
    "generalAvgEngineSpeedKn" DOUBLE PRECISION,
    "weatherCondition" TEXT,
    "generalAvgSlipPct" DOUBLE PRECISION,
    "barometer" DOUBLE PRECISION,
    "exhaustTempUnit" TEXT,
    "exhaustGasTemp" TEXT,
    "etaNextPortDate" TIMESTAMP(3),
    "etaNextPortTime" TEXT,
    "etaNextPortZd" TEXT,
    "cargoOnboard" TEXT,
    "cargoToDiscLoaded" TEXT,
    "blQuantity" DOUBLE PRECISION,
    "cargoTemp" TEXT,
    "agentName" TEXT,
    "agentTel" TEXT,
    "agentFax" TEXT,
    "agentEmail" TEXT,
    "agentAddress" TEXT,
    "deckDeptReport" TEXT,
    "engineDeptReport" TEXT,
    "statementOfFacts" TEXT,
    "master" TEXT,
    "chiefEngineer" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "VoyageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoyageLogBunker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "voyageLogId" TEXT NOT NULL,
    "grade" "BunkerGrade" NOT NULL,
    "previous" DOUBLE PRECISION,
    "consumed" DOUBLE PRECISION,
    "received" DOUBLE PRECISION,
    "rob" DOUBLE PRECISION,

    CONSTRAINT "VoyageLogBunker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitMaster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "metric" "UnitMasterMetric" NOT NULL,
    "unit" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "standardUnit" TEXT NOT NULL,
    "toStandardFactor" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "UnitMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "ballastWaterQuantity" DOUBLE PRECISION,
    "ballastWaterOperations" INTEGER,
    "ballastWaterMethod" TEXT,
    "ballastWaterRemarks" TEXT,
    "sewageDischargedAtSea" DOUBLE PRECISION,
    "sewageDischargedToFacility" DOUBLE PRECISION,
    "sewageUnit" TEXT,
    "sewageQuantityNormalized" DOUBLE PRECISION,
    "sewageQuantityStandardUnit" TEXT,
    "sewageReceptionFacility" TEXT,
    "sewageRemarks" TEXT,
    "greyWaterGenerated" DOUBLE PRECISION,
    "greyWaterDischarged" DOUBLE PRECISION,
    "greyWaterRetained" DOUBLE PRECISION,
    "greyWaterRemarks" TEXT,
    "refrigerantGasType" TEXT,
    "refrigerantEquipment" TEXT,
    "refrigerantAdded" DOUBLE PRECISION,
    "refrigerantRecovered" DOUBLE PRECISION,
    "refrigerantDisposedAshore" DOUBLE PRECISION,
    "refrigerantLeakage" DOUBLE PRECISION,
    "refrigerantQuantityKg" DOUBLE PRECISION,
    "refrigerantRemarks" TEXT,
    "cargoLoaded" DOUBLE PRECISION,
    "cargoDischarged" DOUBLE PRECISION,
    "cargoType" TEXT,
    "cargoUnit" TEXT,
    "cargoLoadedNormalized" DOUBLE PRECISION,
    "cargoDischargedNormalized" DOUBLE PRECISION,
    "cargoStandardUnit" TEXT,
    "cargoPort" TEXT,
    "lubeOilType" TEXT,
    "lubeOilAdded" DOUBLE PRECISION,
    "lubeOilTransferred" DOUBLE PRECISION,
    "lubeOilLost" DOUBLE PRECISION,
    "lubeOilEquipment" TEXT,
    "lubeOilRemarks" TEXT,
    "bilgeGenerated" DOUBLE PRECISION,
    "bilgeProcessed" DOUBLE PRECISION,
    "bilgeDischargedOws" DOUBLE PRECISION,
    "bilgeLandedAshore" DOUBLE PRECISION,
    "bilgeRetained" DOUBLE PRECISION,
    "bilgeRemarks" TEXT,
    "sludgeGenerated" DOUBLE PRECISION,
    "sludgeRetained" DOUBLE PRECISION,
    "sludgeTransferredIncinerator" DOUBLE PRECISION,
    "sludgeLandedAshore" DOUBLE PRECISION,
    "sludgeRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "EnvironmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarbageLedgerEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "environmentRecordId" TEXT NOT NULL,
    "category" "GarbageCategory" NOT NULL,
    "overboardToSeaCbm" DOUBLE PRECISION,
    "incineratedCbm" DOUBLE PRECISION,
    "dischargeAshoreCbm" DOUBLE PRECISION,

    CONSTRAINT "GarbageLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefSequence" (
    "companyId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RefSequence_pkey" PRIMARY KEY ("companyId","prefix")
);

-- CreateTable
CREATE TABLE "TmsaAssessment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "elementNumber" INTEGER NOT NULL,
    "elementCode" TEXT NOT NULL DEFAULT '',
    "stage" INTEGER NOT NULL,
    "questionNo" INTEGER NOT NULL DEFAULT 0,
    "kpiDescription" TEXT NOT NULL,
    "complianceStatus" "TmsaComplianceStatus" NOT NULL,
    "remarks" TEXT,
    "bpg" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "responseState" "TmsaResponseState" NOT NULL DEFAULT 'ON_OCIMF',
    "revisedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "TmsaAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TmsaScore" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "elementCode" TEXT NOT NULL,
    "elementBase" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "s1Yes" INTEGER NOT NULL,
    "s1Req" INTEGER NOT NULL,
    "s2Yes" INTEGER NOT NULL,
    "s2Req" INTEGER NOT NULL,
    "s3Yes" INTEGER NOT NULL,
    "s3Req" INTEGER NOT NULL,
    "s4Yes" INTEGER NOT NULL,
    "s4Req" INTEGER NOT NULL,
    "noCount" INTEGER NOT NULL,
    "reqTotal" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "stageCleared" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "TmsaScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TmsaFinding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "auditYear" INTEGER NOT NULL DEFAULT 2024,
    "elementCode" TEXT NOT NULL,
    "elementBase" INTEGER NOT NULL,
    "stageQ" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "questionNo" INTEGER NOT NULL DEFAULT 0,
    "kpiRef" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "correctiveAction" TEXT NOT NULL,
    "status" "TmsaFindingStatus" NOT NULL DEFAULT 'OPEN',
    "responsible" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "TmsaFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoresCatalogueItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "impaCode" TEXT,
    "name" TEXT NOT NULL,
    "category" "StoresCategory" NOT NULL,
    "department" "RequisitionDepartment" NOT NULL DEFAULT 'DECK',
    "unit" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "subGroup" TEXT,
    "remarks" TEXT,
    "requiresExpiryTracking" BOOLEAN NOT NULL DEFAULT false,
    "medicalChestCompliance" BOOLEAN NOT NULL DEFAULT false,
    "imoHazardClass" TEXT,
    "shelfLifeMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "StoresCatalogueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparesCatalogueItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "makerName" TEXT NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "location" TEXT,
    "criticalSpare" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "SparesCatalogueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningStockTake" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "status" "StockTakeStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "OpeningStockTake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "eventType" "InventoryEventType" NOT NULL,
    "condition" "InventoryCondition" NOT NULL DEFAULT 'USABLE',
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "location" TEXT,
    "remarks" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "openingStockTakeId" TEXT,

    CONSTRAINT "InventoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryUpdateDraft" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "department" "RequisitionDepartment",
    "category" "StoresCategory",
    "status" "InventoryUpdateStatus" NOT NULL DEFAULT 'DRAFT',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "linesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,

    CONSTRAINT "InventoryUpdateDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "refNo" TEXT,
    "category" "RequisitionCategory" NOT NULL,
    "department" "RequisitionDepartment" NOT NULL DEFAULT 'DECK',
    "currentRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionRevision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "status" "RequisitionRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedBy" TEXT,
    "masterApprovedAt" TIMESTAMP(3),
    "masterApprovedBy" TEXT,
    "sentToOfficeAt" TIMESTAMP(3),
    "forQuotationAt" TIMESTAMP(3),
    "forDeliveryAt" TIMESTAMP(3),
    "deliveryPort" TEXT,
    "receivedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "RequisitionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "itemType" "RequisitionLineItemType" NOT NULL,
    "itemId" TEXT,
    "nonCatalogueDescription" TEXT,
    "unit" TEXT,
    "impaCode" TEXT,
    "qtyRequested" DOUBLE PRECISION NOT NULL,
    "robAtRequestTime" DOUBLE PRECISION,
    "remarks" TEXT,
    "qtyApproved" DOUBLE PRECISION,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "qtyReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_department_idx" ON "User"("department");

-- CreateIndex
CREATE INDEX "User_vesselId_idx" ON "User"("vesselId");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_code_key" ON "Vessel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_imo_key" ON "Vessel"("imo");

-- CreateIndex
CREATE INDEX "Vessel_companyId_idx" ON "Vessel"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_companyId_code_key" ON "Vessel"("companyId", "code");

-- CreateIndex
CREATE INDEX "BudgetOpex_companyId_vesselId_monthYear_idx" ON "BudgetOpex"("companyId", "vesselId", "monthYear");

-- CreateIndex
CREATE INDEX "CalendarEvent_companyId_startAt_idx" ON "CalendarEvent"("companyId", "startAt");

-- CreateIndex
CREATE INDEX "BudgetSchedule_companyId_idx" ON "BudgetSchedule"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_entityType_entityId_idx" ON "AuditLog"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "Attachment_companyId_entityType_entityId_idx" ON "Attachment"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Comment_companyId_entityType_entityId_idx" ON "Comment"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "CapaAction_companyId_entityType_entityId_kind_idx" ON "CapaAction"("companyId", "entityType", "entityId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CapaAction_companyId_entityType_entityId_kind_code_key" ON "CapaAction"("companyId", "entityType", "entityId", "kind", "code");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_companyId_entityType_idx" ON "WorkflowDefinition"("companyId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_companyId_key_key" ON "WorkflowDefinition"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_definitionId_order_key" ON "WorkflowStep"("definitionId", "order");

-- CreateIndex
CREATE INDEX "WorkflowInstance_companyId_entityType_entityId_idx" ON "WorkflowInstance"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_companyId_status_idx" ON "WorkflowInstance"("companyId", "status");

-- CreateIndex
CREATE INDEX "WorkflowAction_instanceId_idx" ON "WorkflowAction"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsDocument_currentRevisionId_key" ON "SmsDocument"("currentRevisionId");

-- CreateIndex
CREATE INDEX "SmsDocument_companyId_department_idx" ON "SmsDocument"("companyId", "department");

-- CreateIndex
CREATE INDEX "SmsDocument_companyId_status_idx" ON "SmsDocument"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SmsDocument_companyId_code_key" ON "SmsDocument"("companyId", "code");

-- CreateIndex
CREATE INDEX "SmsRevision_companyId_documentId_idx" ON "SmsRevision"("companyId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsRevision_documentId_revisionNo_key" ON "SmsRevision"("documentId", "revisionNo");

-- CreateIndex
CREATE INDEX "Incident_companyId_status_idx" ON "Incident"("companyId", "status");

-- CreateIndex
CREATE INDEX "Incident_companyId_severity_idx" ON "Incident"("companyId", "severity");

-- CreateIndex
CREATE INDEX "Incident_companyId_vesselId_idx" ON "Incident"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "Incident_companyId_occurredAt_idx" ON "Incident"("companyId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_companyId_refNo_key" ON "Incident"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "IncidentSofEntry_incidentId_idx" ON "IncidentSofEntry"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentTypeEntry_incidentId_idx" ON "IncidentTypeEntry"("incidentId");

-- CreateIndex
CREATE INDEX "NearMiss_companyId_status_idx" ON "NearMiss"("companyId", "status");

-- CreateIndex
CREATE INDEX "NearMiss_companyId_kind_idx" ON "NearMiss"("companyId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "NearMiss_companyId_refNo_key" ON "NearMiss"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "NonConformity_companyId_status_idx" ON "NonConformity"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NonConformity_companyId_refNo_key" ON "NonConformity"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "SireInspection_companyId_status_idx" ON "SireInspection"("companyId", "status");

-- CreateIndex
CREATE INDEX "SireInspection_companyId_vesselId_idx" ON "SireInspection"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "SireInspection_companyId_inspectionDate_idx" ON "SireInspection"("companyId", "inspectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "SireInspection_companyId_refNo_key" ON "SireInspection"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "SireObservation_inspectionId_idx" ON "SireObservation"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SireObservation_inspectionId_seq_key" ON "SireObservation"("inspectionId", "seq");

-- CreateIndex
CREATE INDEX "SireObservationComment_observationId_idx" ON "SireObservationComment"("observationId");

-- CreateIndex
CREATE INDEX "SireQuestionnaireVersion_companyId_isActive_idx" ON "SireQuestionnaireVersion"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "SireQuestionnaireItem_companyId_versionId_idx" ON "SireQuestionnaireItem"("companyId", "versionId");

-- CreateIndex
CREATE INDEX "SireQuestionnaireItem_companyId_versionId_chapter_idx" ON "SireQuestionnaireItem"("companyId", "versionId", "chapter");

-- CreateIndex
CREATE INDEX "PscInspection_companyId_status_idx" ON "PscInspection"("companyId", "status");

-- CreateIndex
CREATE INDEX "PscInspection_companyId_vesselId_idx" ON "PscInspection"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "PscInspection_companyId_inspectionDate_idx" ON "PscInspection"("companyId", "inspectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "PscInspection_companyId_refNo_key" ON "PscInspection"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "PscDeficiency_inspectionId_idx" ON "PscDeficiency"("inspectionId");

-- CreateIndex
CREATE INDEX "CdiInspection_companyId_status_idx" ON "CdiInspection"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CdiInspection_companyId_refNo_key" ON "CdiInspection"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "CdiObservation_inspectionId_idx" ON "CdiObservation"("inspectionId");

-- CreateIndex
CREATE INDEX "InternalAudit_companyId_status_idx" ON "InternalAudit"("companyId", "status");

-- CreateIndex
CREATE INDEX "InternalAudit_companyId_vesselId_idx" ON "InternalAudit"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "InternalAudit_companyId_auditDate_idx" ON "InternalAudit"("companyId", "auditDate");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAudit_companyId_refNo_key" ON "InternalAudit"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "InternalAuditFinding_auditId_idx" ON "InternalAuditFinding"("auditId");

-- CreateIndex
CREATE INDEX "ExternalAudit_companyId_status_idx" ON "ExternalAudit"("companyId", "status");

-- CreateIndex
CREATE INDEX "ExternalAudit_companyId_vesselId_idx" ON "ExternalAudit"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "ExternalAudit_companyId_auditDate_idx" ON "ExternalAudit"("companyId", "auditDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAudit_companyId_refNo_key" ON "ExternalAudit"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "ExternalAuditFinding_auditId_idx" ON "ExternalAuditFinding"("auditId");

-- CreateIndex
CREATE INDEX "CompanyInspection_companyId_status_idx" ON "CompanyInspection"("companyId", "status");

-- CreateIndex
CREATE INDEX "CompanyInspection_companyId_vesselId_idx" ON "CompanyInspection"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "CompanyInspection_companyId_inspectionDate_idx" ON "CompanyInspection"("companyId", "inspectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInspection_companyId_refNo_key" ON "CompanyInspection"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "CompanyInspectionObservation_inspectionId_idx" ON "CompanyInspectionObservation"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInspectionObservation_inspectionId_seq_key" ON "CompanyInspectionObservation"("inspectionId", "seq");

-- CreateIndex
CREATE INDEX "ExposureCrewEntry_companyId_vesselId_effectiveFrom_idx" ON "ExposureCrewEntry"("companyId", "vesselId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ExposureInjuryCase_companyId_vesselId_occurredOn_idx" ON "ExposureInjuryCase"("companyId", "vesselId", "occurredOn");

-- CreateIndex
CREATE INDEX "CommitteeMeeting_companyId_vesselId_idx" ON "CommitteeMeeting"("companyId", "vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMeeting_companyId_refNo_key" ON "CommitteeMeeting"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "CommitteeMeetingAgenda_meetingId_idx" ON "CommitteeMeetingAgenda"("meetingId");

-- CreateIndex
CREATE INDEX "ScheduleItem_companyId_kind_sortOrder_idx" ON "ScheduleItem"("companyId", "kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleItem_companyId_kind_itemNo_key" ON "ScheduleItem"("companyId", "kind", "itemNo");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleApplicability_companyId_vesselId_scheduleItemId_key" ON "ScheduleApplicability"("companyId", "vesselId", "scheduleItemId");

-- CreateIndex
CREATE INDEX "EmergencyDrill_companyId_status_idx" ON "EmergencyDrill"("companyId", "status");

-- CreateIndex
CREATE INDEX "EmergencyDrill_companyId_vesselId_scheduleItemId_idx" ON "EmergencyDrill"("companyId", "vesselId", "scheduleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyDrill_companyId_refNo_key" ON "EmergencyDrill"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "FamiliarizationRecord_companyId_vesselId_scheduleItemId_idx" ON "FamiliarizationRecord"("companyId", "vesselId", "scheduleItemId");

-- CreateIndex
CREATE INDEX "FamiliarizationSession_companyId_vesselId_idx" ON "FamiliarizationSession"("companyId", "vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "FamiliarizationSession_companyId_refNo_key" ON "FamiliarizationSession"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "LsaFfeItem_companyId_category_idx" ON "LsaFfeItem"("companyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "LsaFfeItem_companyId_category_itemNo_key" ON "LsaFfeItem"("companyId", "category", "itemNo");

-- CreateIndex
CREATE INDEX "CrewFamiliarization_companyId_vesselId_idx" ON "CrewFamiliarization"("companyId", "vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewFamiliarization_companyId_refNo_key" ON "CrewFamiliarization"("companyId", "refNo");

-- CreateIndex
CREATE UNIQUE INDEX "CrewFamiliarizationRecord_crewFamiliarizationId_lsaFfeItemI_key" ON "CrewFamiliarizationRecord"("crewFamiliarizationId", "lsaFfeItemId");

-- CreateIndex
CREATE INDEX "ControlledDocument_companyId_status_idx" ON "ControlledDocument"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ControlledDocument_companyId_docNumber_key" ON "ControlledDocument"("companyId", "docNumber");

-- CreateIndex
CREATE INDEX "VesselDocument_companyId_vesselId_idx" ON "VesselDocument"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "VesselDocument_companyId_type_idx" ON "VesselDocument"("companyId", "type");

-- CreateIndex
CREATE INDEX "Circular_companyId_source_idx" ON "Circular"("companyId", "source");

-- CreateIndex
CREATE INDEX "Circular_companyId_category_idx" ON "Circular"("companyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Circular_companyId_refNo_key" ON "Circular"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "CircularAcknowledgement_companyId_recipientType_recipientId_idx" ON "CircularAcknowledgement"("companyId", "recipientType", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "CircularAcknowledgement_circularId_recipientType_recipientI_key" ON "CircularAcknowledgement"("circularId", "recipientType", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessmentDocument_currentRevisionId_key" ON "RiskAssessmentDocument"("currentRevisionId");

-- CreateIndex
CREATE INDEX "RiskAssessmentDocument_companyId_status_idx" ON "RiskAssessmentDocument"("companyId", "status");

-- CreateIndex
CREATE INDEX "RiskAssessmentDocument_companyId_nextReviewDate_idx" ON "RiskAssessmentDocument"("companyId", "nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessmentDocument_companyId_refNo_key" ON "RiskAssessmentDocument"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "RiskAssessmentRevision_companyId_documentId_idx" ON "RiskAssessmentRevision"("companyId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessmentRevision_documentId_revisionNo_key" ON "RiskAssessmentRevision"("documentId", "revisionNo");

-- CreateIndex
CREATE INDEX "RiskHazardRow_companyId_revisionId_rowNo_idx" ON "RiskHazardRow"("companyId", "revisionId", "rowNo");

-- CreateIndex
CREATE INDEX "RiskHazardRow_companyId_vesselId_idx" ON "RiskHazardRow"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "RiskAssessmentExecution_companyId_documentId_idx" ON "RiskAssessmentExecution"("companyId", "documentId");

-- CreateIndex
CREATE INDEX "RiskAssessmentExecution_companyId_vesselId_idx" ON "RiskAssessmentExecution"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "RiskAssessmentRevisionRequest_companyId_documentId_status_idx" ON "RiskAssessmentRevisionRequest"("companyId", "documentId", "status");

-- CreateIndex
CREATE INDEX "Defect_companyId_status_idx" ON "Defect"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Defect_companyId_refNo_key" ON "Defect"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "VoyageLog_companyId_vesselId_date_idx" ON "VoyageLog"("companyId", "vesselId", "date");

-- CreateIndex
CREATE INDEX "VoyageLogBunker_companyId_voyageLogId_idx" ON "VoyageLogBunker"("companyId", "voyageLogId");

-- CreateIndex
CREATE UNIQUE INDEX "VoyageLogBunker_voyageLogId_grade_key" ON "VoyageLogBunker"("voyageLogId", "grade");

-- CreateIndex
CREATE INDEX "UnitMaster_companyId_metric_idx" ON "UnitMaster"("companyId", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "UnitMaster_companyId_metric_unit_key" ON "UnitMaster"("companyId", "metric", "unit");

-- CreateIndex
CREATE INDEX "EnvironmentRecord_companyId_vesselId_year_month_idx" ON "EnvironmentRecord"("companyId", "vesselId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentRecord_vesselId_year_month_key" ON "EnvironmentRecord"("vesselId", "year", "month");

-- CreateIndex
CREATE INDEX "GarbageLedgerEntry_companyId_environmentRecordId_idx" ON "GarbageLedgerEntry"("companyId", "environmentRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "GarbageLedgerEntry_environmentRecordId_category_key" ON "GarbageLedgerEntry"("environmentRecordId", "category");

-- CreateIndex
CREATE INDEX "TmsaAssessment_companyId_elementCode_idx" ON "TmsaAssessment"("companyId", "elementCode");

-- CreateIndex
CREATE UNIQUE INDEX "TmsaAssessment_companyId_code_key" ON "TmsaAssessment"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TmsaScore_companyId_year_elementCode_key" ON "TmsaScore"("companyId", "year", "elementCode");

-- CreateIndex
CREATE INDEX "TmsaFinding_companyId_elementCode_idx" ON "TmsaFinding"("companyId", "elementCode");

-- CreateIndex
CREATE INDEX "TmsaFinding_companyId_status_idx" ON "TmsaFinding"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TmsaFinding_companyId_code_key" ON "TmsaFinding"("companyId", "code");

-- CreateIndex
CREATE INDEX "StoresCatalogueItem_companyId_vesselId_category_idx" ON "StoresCatalogueItem"("companyId", "vesselId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "StoresCatalogueItem_companyId_vesselId_impaCode_key" ON "StoresCatalogueItem"("companyId", "vesselId", "impaCode");

-- CreateIndex
CREATE INDEX "SparesCatalogueItem_companyId_vesselId_idx" ON "SparesCatalogueItem"("companyId", "vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "SparesCatalogueItem_companyId_vesselId_makerName_partNo_key" ON "SparesCatalogueItem"("companyId", "vesselId", "makerName", "partNo");

-- CreateIndex
CREATE INDEX "OpeningStockTake_companyId_idx" ON "OpeningStockTake"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningStockTake_vesselId_key" ON "OpeningStockTake"("vesselId");

-- CreateIndex
CREATE INDEX "InventoryEvent_companyId_vesselId_itemType_itemId_idx" ON "InventoryEvent"("companyId", "vesselId", "itemType", "itemId");

-- CreateIndex
CREATE INDEX "InventoryUpdateDraft_companyId_vesselId_status_idx" ON "InventoryUpdateDraft"("companyId", "vesselId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_currentRevisionId_key" ON "Requisition"("currentRevisionId");

-- CreateIndex
CREATE INDEX "Requisition_companyId_vesselId_idx" ON "Requisition"("companyId", "vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_companyId_refNo_key" ON "Requisition"("companyId", "refNo");

-- CreateIndex
CREATE UNIQUE INDEX "RequisitionRevision_requisitionId_revisionNo_key" ON "RequisitionRevision"("requisitionId", "revisionNo");

-- CreateIndex
CREATE INDEX "RequisitionLine_companyId_revisionId_idx" ON "RequisitionLine"("companyId", "revisionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vessel" ADD CONSTRAINT "Vessel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetOpex" ADD CONSTRAINT "BudgetOpex_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetOpex" ADD CONSTRAINT "BudgetOpex_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetSchedule" ADD CONSTRAINT "BudgetSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsDocument" ADD CONSTRAINT "SmsDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsDocument" ADD CONSTRAINT "SmsDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsDocument" ADD CONSTRAINT "SmsDocument_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsDocument" ADD CONSTRAINT "SmsDocument_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "SmsRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsRevision" ADD CONSTRAINT "SmsRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SmsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentSofEntry" ADD CONSTRAINT "IncidentSofEntry_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTypeEntry" ADD CONSTRAINT "IncidentTypeEntry_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireInspection" ADD CONSTRAINT "SireInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireInspection" ADD CONSTRAINT "SireInspection_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireObservation" ADD CONSTRAINT "SireObservation_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "SireInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireObservation" ADD CONSTRAINT "SireObservation_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireObservation" ADD CONSTRAINT "SireObservation_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireObservationComment" ADD CONSTRAINT "SireObservationComment_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "SireObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireObservationComment" ADD CONSTRAINT "SireObservationComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireQuestionnaireVersion" ADD CONSTRAINT "SireQuestionnaireVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SireQuestionnaireItem" ADD CONSTRAINT "SireQuestionnaireItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SireQuestionnaireVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PscInspection" ADD CONSTRAINT "PscInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PscInspection" ADD CONSTRAINT "PscInspection_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PscDeficiency" ADD CONSTRAINT "PscDeficiency_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PscInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CdiInspection" ADD CONSTRAINT "CdiInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CdiInspection" ADD CONSTRAINT "CdiInspection_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CdiObservation" ADD CONSTRAINT "CdiObservation_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "CdiInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAudit" ADD CONSTRAINT "InternalAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAudit" ADD CONSTRAINT "InternalAudit_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditFinding" ADD CONSTRAINT "InternalAuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InternalAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAudit" ADD CONSTRAINT "ExternalAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAudit" ADD CONSTRAINT "ExternalAudit_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuditFinding" ADD CONSTRAINT "ExternalAuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "ExternalAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInspection" ADD CONSTRAINT "CompanyInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInspection" ADD CONSTRAINT "CompanyInspection_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInspectionObservation" ADD CONSTRAINT "CompanyInspectionObservation_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "CompanyInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMeeting" ADD CONSTRAINT "CommitteeMeeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMeeting" ADD CONSTRAINT "CommitteeMeeting_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMeetingAgenda" ADD CONSTRAINT "CommitteeMeetingAgenda_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CommitteeMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleApplicability" ADD CONSTRAINT "ScheduleApplicability_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleApplicability" ADD CONSTRAINT "ScheduleApplicability_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleApplicability" ADD CONSTRAINT "ScheduleApplicability_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamiliarizationRecord" ADD CONSTRAINT "FamiliarizationRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamiliarizationRecord" ADD CONSTRAINT "FamiliarizationRecord_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamiliarizationRecord" ADD CONSTRAINT "FamiliarizationRecord_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamiliarizationRecord" ADD CONSTRAINT "FamiliarizationRecord_familiarizationSessionId_fkey" FOREIGN KEY ("familiarizationSessionId") REFERENCES "FamiliarizationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamiliarizationSession" ADD CONSTRAINT "FamiliarizationSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamiliarizationSession" ADD CONSTRAINT "FamiliarizationSession_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LsaFfeItem" ADD CONSTRAINT "LsaFfeItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewFamiliarization" ADD CONSTRAINT "CrewFamiliarization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewFamiliarization" ADD CONSTRAINT "CrewFamiliarization_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewFamiliarizationRecord" ADD CONSTRAINT "CrewFamiliarizationRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewFamiliarizationRecord" ADD CONSTRAINT "CrewFamiliarizationRecord_crewFamiliarizationId_fkey" FOREIGN KEY ("crewFamiliarizationId") REFERENCES "CrewFamiliarization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewFamiliarizationRecord" ADD CONSTRAINT "CrewFamiliarizationRecord_lsaFfeItemId_fkey" FOREIGN KEY ("lsaFfeItemId") REFERENCES "LsaFfeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledDocument" ADD CONSTRAINT "ControlledDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlledDocument" ADD CONSTRAINT "ControlledDocument_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselDocument" ADD CONSTRAINT "VesselDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselDocument" ADD CONSTRAINT "VesselDocument_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circular" ADD CONSTRAINT "Circular_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circular" ADD CONSTRAINT "Circular_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircularAcknowledgement" ADD CONSTRAINT "CircularAcknowledgement_circularId_fkey" FOREIGN KEY ("circularId") REFERENCES "Circular"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentDocument" ADD CONSTRAINT "RiskAssessmentDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentDocument" ADD CONSTRAINT "RiskAssessmentDocument_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentDocument" ADD CONSTRAINT "RiskAssessmentDocument_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "RiskAssessmentRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentRevision" ADD CONSTRAINT "RiskAssessmentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RiskAssessmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskHazardRow" ADD CONSTRAINT "RiskHazardRow_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "RiskAssessmentRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskHazardRow" ADD CONSTRAINT "RiskHazardRow_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentExecution" ADD CONSTRAINT "RiskAssessmentExecution_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RiskAssessmentDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentExecution" ADD CONSTRAINT "RiskAssessmentExecution_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "RiskAssessmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentExecution" ADD CONSTRAINT "RiskAssessmentExecution_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentRevisionRequest" ADD CONSTRAINT "RiskAssessmentRevisionRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RiskAssessmentDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentRevisionRequest" ADD CONSTRAINT "RiskAssessmentRevisionRequest_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageLog" ADD CONSTRAINT "VoyageLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageLog" ADD CONSTRAINT "VoyageLog_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageLogBunker" ADD CONSTRAINT "VoyageLogBunker_voyageLogId_fkey" FOREIGN KEY ("voyageLogId") REFERENCES "VoyageLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitMaster" ADD CONSTRAINT "UnitMaster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentRecord" ADD CONSTRAINT "EnvironmentRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentRecord" ADD CONSTRAINT "EnvironmentRecord_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarbageLedgerEntry" ADD CONSTRAINT "GarbageLedgerEntry_environmentRecordId_fkey" FOREIGN KEY ("environmentRecordId") REFERENCES "EnvironmentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefSequence" ADD CONSTRAINT "RefSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TmsaAssessment" ADD CONSTRAINT "TmsaAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TmsaScore" ADD CONSTRAINT "TmsaScore_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TmsaFinding" ADD CONSTRAINT "TmsaFinding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoresCatalogueItem" ADD CONSTRAINT "StoresCatalogueItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoresCatalogueItem" ADD CONSTRAINT "StoresCatalogueItem_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparesCatalogueItem" ADD CONSTRAINT "SparesCatalogueItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparesCatalogueItem" ADD CONSTRAINT "SparesCatalogueItem_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningStockTake" ADD CONSTRAINT "OpeningStockTake_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningStockTake" ADD CONSTRAINT "OpeningStockTake_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_openingStockTakeId_fkey" FOREIGN KEY ("openingStockTakeId") REFERENCES "OpeningStockTake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUpdateDraft" ADD CONSTRAINT "InventoryUpdateDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUpdateDraft" ADD CONSTRAINT "InventoryUpdateDraft_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "RequisitionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionRevision" ADD CONSTRAINT "RequisitionRevision_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionRevision" ADD CONSTRAINT "RequisitionRevision_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "RequisitionRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

