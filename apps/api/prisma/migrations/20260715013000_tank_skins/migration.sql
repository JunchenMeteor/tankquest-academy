ALTER TABLE "child_tanks" ADD COLUMN "selected_skin_id" TEXT;

CREATE TABLE "tank_skins" (
    "id" TEXT NOT NULL,
    "tank_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "tank_skins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "child_tank_skins" (
    "id" TEXT NOT NULL,
    "child_tank_id" TEXT NOT NULL,
    "skin_id" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "child_tank_skins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tank_skins_tank_id_code_key" ON "tank_skins"("tank_id", "code");
CREATE UNIQUE INDEX "child_tank_skins_child_tank_id_skin_id_key" ON "child_tank_skins"("child_tank_id", "skin_id");

ALTER TABLE "tank_skins" ADD CONSTRAINT "tank_skins_tank_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_tank_skins" ADD CONSTRAINT "child_tank_skins_child_tank_id_fkey" FOREIGN KEY ("child_tank_id") REFERENCES "child_tanks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_tank_skins" ADD CONSTRAINT "child_tank_skins_skin_id_fkey" FOREIGN KEY ("skin_id") REFERENCES "tank_skins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_tanks" ADD CONSTRAINT "child_tanks_selected_skin_id_fkey" FOREIGN KEY ("selected_skin_id") REFERENCES "tank_skins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
