import { Inject, Injectable } from '@nestjs/common';
import { tankStatMax } from '@tankquest/shared';

import { PrismaService } from '../prisma.service.js';
import type {
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
}
