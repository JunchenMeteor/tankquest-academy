-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('parent', 'admin');
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "SessionStatus" AS ENUM ('active', 'finished', 'abandoned');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'parent',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "parent_user_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "birth_year" INTEGER NOT NULL,
    "age_group" TEXT NOT NULL,
    "default_mode" TEXT NOT NULL DEFAULT 'child_learning',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "parent_controls" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "daily_minutes_limit" INTEGER NOT NULL DEFAULT 30,
    "session_minutes_limit" INTEGER NOT NULL DEFAULT 10,
    "allowed_modes" TEXT[] DEFAULT ARRAY['child_learning']::TEXT[],
    "allowed_subjects" TEXT[] DEFAULT ARRAY['math']::TEXT[],
    "max_difficulty" INTEGER NOT NULL DEFAULT 2,
    "ai_explanation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "adult_tests_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "parent_controls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tanks" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "tanks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tank_stats" (
    "id" TEXT NOT NULL,
    "tank_id" TEXT NOT NULL,
    "firepower" INTEGER NOT NULL,
    "mobility" INTEGER NOT NULL,
    "armor" INTEGER NOT NULL,
    "stealth" INTEGER NOT NULL,
    "vision" INTEGER NOT NULL,
    CONSTRAINT "tank_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "child_tanks" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "tank_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "child_tanks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "child_tank_upgrades" (
    "id" TEXT NOT NULL,
    "child_tank_id" TEXT NOT NULL,
    "stat_key" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "child_tank_upgrades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title_key" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "subject_focus" TEXT NOT NULL,
    "base_difficulty" INTEGER NOT NULL,
    "config_json" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "question_answers" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    CONSTRAINT "question_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "level_questions" (
    "level_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    CONSTRAINT "level_questions_pkey" PRIMARY KEY ("level_id", "question_id")
);

CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "tank_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "difficulty_snapshot_json" JSONB NOT NULL,
    "reward_summary_json" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_session_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "client_time_ms" INTEGER NOT NULL,
    "server_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_session_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_session_answers" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_answer_id" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "answer_time_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_session_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_session_rewards" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_key" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    CONSTRAINT "game_session_rewards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "child_inventory" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "child_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "parent_controls_child_id_key" ON "parent_controls"("child_id");
CREATE UNIQUE INDEX "tanks_code_key" ON "tanks"("code");
CREATE UNIQUE INDEX "tank_stats_tank_id_key" ON "tank_stats"("tank_id");
CREATE UNIQUE INDEX "child_tanks_child_id_tank_id_key" ON "child_tanks"("child_id", "tank_id");
CREATE UNIQUE INDEX "child_tank_upgrades_child_tank_id_stat_key_key" ON "child_tank_upgrades"("child_tank_id", "stat_key");
CREATE UNIQUE INDEX "levels_code_key" ON "levels"("code");
CREATE UNIQUE INDEX "game_session_answers_session_id_question_id_key" ON "game_session_answers"("session_id", "question_id");
CREATE UNIQUE INDEX "child_inventory_child_id_item_type_item_key_key" ON "child_inventory"("child_id", "item_type", "item_key");

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parent_controls" ADD CONSTRAINT "parent_controls_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tank_stats" ADD CONSTRAINT "tank_stats_tank_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_tanks" ADD CONSTRAINT "child_tanks_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_tanks" ADD CONSTRAINT "child_tanks_tank_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "child_tank_upgrades" ADD CONSTRAINT "child_tank_upgrades_child_tank_id_fkey" FOREIGN KEY ("child_tank_id") REFERENCES "child_tanks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "level_questions" ADD CONSTRAINT "level_questions_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "level_questions" ADD CONSTRAINT "level_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_tank_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_session_events" ADD CONSTRAINT "game_session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_session_answers" ADD CONSTRAINT "game_session_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_session_answers" ADD CONSTRAINT "game_session_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_session_rewards" ADD CONSTRAINT "game_session_rewards_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_inventory" ADD CONSTRAINT "child_inventory_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
