ALTER TABLE "questions" ADD COLUMN "skill_key" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "questions" ALTER COLUMN "skill_key" DROP DEFAULT;

CREATE TABLE "learning_records" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "skill_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "average_answer_time_ms" INTEGER NOT NULL DEFAULT 0,
    "current_difficulty" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "learning_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_records_child_id_subject_skill_key_key" ON "learning_records"("child_id", "subject", "skill_key");

ALTER TABLE "learning_records" ADD CONSTRAINT "learning_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
