import { Inject, Injectable } from '@nestjs/common';
import {
  tankStatMax,
  type OwnedTankDto,
  type TankSkinDto,
} from '@tankquest/shared';

import { PrismaService } from '../prisma.service.js';
import { applyTankUpgrades } from '../game-sessions/tank-upgrades.js';
import type {
  EquipSkinResult,
  UpgradeMaterial,
  UpgradeResult,
  UpgradeStat,
} from './progression.models.js';
import { ProgressionRepository } from './progression.repository.js';

@Injectable()
export class PrismaProgressionRepository extends ProgressionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listOwnedTanks(childId: string): Promise<OwnedTankDto[]> {
    const ownedTanks = await this.prisma.childTank.findMany({
      where: { childId, tank: { isActive: true } },
      include: {
        tank: {
          include: { stats: true, skins: { where: { isDefault: true } } },
        },
        selectedSkin: true,
        upgrades: true,
      },
      orderBy: { acquiredAt: 'asc' },
    });

    return ownedTanks.flatMap((ownedTank) => {
      const stats = ownedTank.tank.stats;
      if (!stats) return [];
      const skin = ownedTank.selectedSkin ?? ownedTank.tank.skins[0];
      return [
        {
          id: ownedTank.tank.id,
          code: ownedTank.tank.code,
          nameKey: ownedTank.tank.nameKey,
          role: ownedTank.tank.role,
          level: ownedTank.level,
          stats: applyTankUpgrades(stats, ownedTank.upgrades),
          ...(skin ? { skin: this.toSkinAppearance(skin) } : {}),
        },
      ];
    });
  }

  async listSkins(childId: string, tankId: string): Promise<TankSkinDto[]> {
    const ownedTank = await this.prisma.childTank.findUnique({
      where: { childId_tankId: { childId, tankId } },
      include: {
        unlockedSkins: {
          where: { skin: { isActive: true, tankId } },
          include: { skin: true },
          orderBy: { unlockedAt: 'asc' },
        },
      },
    });
    if (!ownedTank) return [];
    return ownedTank.unlockedSkins.map(({ skin }) => ({
      ...this.toSkinAppearance(skin),
      unlocked: true,
      equipped: skin.id === ownedTank.selectedSkinId,
    }));
  }

  async equipSkin(
    childId: string,
    tankId: string,
    skinId: string
  ): Promise<EquipSkinResult> {
    return this.prisma.$transaction(async (transaction) => {
      const ownedTank = await transaction.childTank.findUnique({
        where: { childId_tankId: { childId, tankId } },
        include: {
          unlockedSkins: {
            where: { skinId, skin: { tankId, isActive: true } },
            include: { skin: true },
          },
        },
      });
      const skin = ownedTank?.unlockedSkins[0]?.skin;
      if (!ownedTank || !skin) return { status: 'unavailable' };
      await transaction.childTank.update({
        where: { id: ownedTank.id },
        data: { selectedSkinId: skin.id },
      });
      return {
        status: 'equipped',
        skin: {
          ...this.toSkinAppearance(skin),
          unlocked: true,
          equipped: true,
        },
      };
    });
  }

  async upgradeTank(
    childId: string,
    tankId: string,
    stat: UpgradeStat,
    material: UpgradeMaterial
  ): Promise<UpgradeResult> {
    return this.prisma.$transaction(async (transaction) => {
      const ownedTank = await transaction.childTank.findUnique({
        where: { childId_tankId: { childId, tankId } },
        select: {
          id: true,
          tank: { select: { stats: true } },
          upgrades: {
            where: { statKey: stat },
            select: { level: true },
          },
        },
      });
      const baseValue = ownedTank?.tank.stats?.[stat];
      if (!ownedTank || baseValue == null) {
        return { status: 'unavailable' };
      }
      const currentLevel = ownedTank.upgrades[0]?.level ?? 0;
      if (baseValue + currentLevel >= tankStatMax) {
        return { status: 'max_level' };
      }

      const spent = await transaction.childInventory.updateMany({
        where: {
          childId,
          itemType: 'part',
          itemKey: material.itemKey,
          amount: { gte: material.amount },
        },
        data: { amount: { decrement: material.amount } },
      });
      if (spent.count === 0) {
        return { status: 'insufficient_parts' };
      }

      const [upgrade, inventory] = await Promise.all([
        transaction.childTankUpgrade.upsert({
          where: {
            childTankId_statKey: { childTankId: ownedTank.id, statKey: stat },
          },
          update: { level: { increment: 1 } },
          create: { childTankId: ownedTank.id, statKey: stat, level: 1 },
          select: { level: true },
        }),
        transaction.childInventory.findUniqueOrThrow({
          where: {
            childId_itemType_itemKey: {
              childId,
              itemType: 'part',
              itemKey: material.itemKey,
            },
          },
          select: { amount: true },
        }),
      ]);

      return {
        status: 'upgraded',
        upgrade: {
          tankId,
          stat,
          level: upgrade.level,
          effectiveValue: Math.min(tankStatMax, baseValue + upgrade.level),
          remainingParts: inventory.amount,
        },
      };
    });
  }

  private toSkinAppearance(skin: {
    id: string;
    code: string;
    nameKey: string;
    primaryColor: string;
    secondaryColor: string;
  }) {
    return {
      id: skin.id,
      code: skin.code,
      nameKey: skin.nameKey,
      primaryColor: skin.primaryColor,
      secondaryColor: skin.secondaryColor,
    };
  }
}
