ALTER TABLE "game_sessions"
ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

CREATE TABLE "question_translations" (
    "question_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "question_translations_pkey" PRIMARY KEY ("question_id", "locale")
);

CREATE TABLE "question_answer_translations" (
    "answer_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "question_answer_translations_pkey" PRIMARY KEY ("answer_id", "locale")
);

CREATE TABLE "game_session_questions" (
    "session_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "game_session_questions_pkey" PRIMARY KEY ("session_id", "question_id")
);

CREATE UNIQUE INDEX "game_session_questions_session_id_sort_order_key"
ON "game_session_questions"("session_id", "sort_order");

ALTER TABLE "question_translations"
ADD CONSTRAINT "question_translations_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "question_answer_translations"
ADD CONSTRAINT "question_answer_translations_answer_id_fkey"
FOREIGN KEY ("answer_id") REFERENCES "question_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_session_questions"
ADD CONSTRAINT "game_session_questions_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_session_questions"
ADD CONSTRAINT "game_session_questions_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "question_translations" ("question_id", "locale", "prompt", "explanation")
SELECT "id", 'en', "prompt", "explanation" FROM "questions";

INSERT INTO "question_answer_translations" ("answer_id", "locale", "text")
SELECT "id", 'en', "text" FROM "question_answers";

INSERT INTO "game_session_questions" ("session_id", "question_id", "sort_order")
SELECT
    "game_sessions"."id",
    "level_questions"."question_id",
    ROW_NUMBER() OVER (
        PARTITION BY "game_sessions"."id"
        ORDER BY "level_questions"."question_id"
    )::INTEGER - 1
FROM "game_sessions"
JOIN "level_questions" ON "level_questions"."level_id" = "game_sessions"."level_id";
