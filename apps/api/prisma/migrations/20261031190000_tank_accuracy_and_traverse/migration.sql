-- Add gun accuracy and turret traverse to the tank stat table.
-- Both use the same 1-5 scale as the existing stats; defaults keep old rows valid.
ALTER TABLE "tank_stats" ADD COLUMN "accuracy" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "tank_stats" ADD COLUMN "turret_traverse" INTEGER NOT NULL DEFAULT 3;
