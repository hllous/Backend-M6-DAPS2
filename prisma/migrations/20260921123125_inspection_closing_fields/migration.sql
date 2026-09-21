-- AlterTable
ALTER TABLE "environmental_inspection" ADD COLUMN     "conclusion" TEXT,
ADD COLUMN     "severity" "Severity",
ADD COLUMN     "suggested_action" "SuggestedAction",
ADD COLUMN     "violation_type" "ViolationType";
