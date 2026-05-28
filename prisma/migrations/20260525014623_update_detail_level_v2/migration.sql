BEGIN;

CREATE TYPE "SubjectDetailLevel_new"
AS ENUM ('BASIC','EXPANDED');

ALTER TABLE "public"."Subject"
ALTER COLUMN "minDetailLevel" DROP DEFAULT;

ALTER TABLE "public"."Subtopic"
ALTER COLUMN "detailLevel" DROP DEFAULT;

ALTER TABLE "public"."UserSubject"
ALTER COLUMN "detailLevel" DROP DEFAULT;

ALTER TABLE "UserSubject"
ALTER COLUMN "detailLevel"
TYPE "SubjectDetailLevel_new"
USING (
CASE
    WHEN "detailLevel"::text='ACADEMIC' THEN 'EXPANDED'
    ELSE "detailLevel"::text
END
)::"SubjectDetailLevel_new";

ALTER TABLE "Subtopic"
ALTER COLUMN "detailLevel"
TYPE "SubjectDetailLevel_new"
USING (
CASE
    WHEN "detailLevel"::text='ACADEMIC' THEN 'EXPANDED'
    ELSE "detailLevel"::text
END
)::"SubjectDetailLevel_new";

-- ВАЖНО: удалить зависимую колонку ДО DROP TYPE
ALTER TABLE "Subject"
DROP COLUMN "minDetailLevel";

ALTER TYPE "SubjectDetailLevel"
RENAME TO "SubjectDetailLevel_old";

ALTER TYPE "SubjectDetailLevel_new"
RENAME TO "SubjectDetailLevel";

DROP TYPE "SubjectDetailLevel_old";

ALTER TABLE "Subtopic"
ALTER COLUMN "detailLevel"
SET DEFAULT 'BASIC';

ALTER TABLE "UserSubject"
ALTER COLUMN "detailLevel"
SET DEFAULT 'BASIC';

COMMIT;