import { prisma } from '../config/db';

const APP_CONFIG_ID = 1;

async function ensureAppConfig() {
  return prisma.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    update: {},
    create: { id: APP_CONFIG_ID },
  });
}

export async function isHourlyHopeEnabled(): Promise<boolean> {
  const config = await ensureAppConfig();
  return config.hourlyHopeEnabled;
}

export async function setHourlyHopeEnabled(enabled: boolean): Promise<boolean> {
  const config = await prisma.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    update: { hourlyHopeEnabled: enabled },
    create: { id: APP_CONFIG_ID, hourlyHopeEnabled: enabled },
  });
  return config.hourlyHopeEnabled;
}

export interface HourlyHopeConfig {
  postingEnabled: boolean;
  visible: boolean;
}

export async function getHourlyHopeConfig(): Promise<HourlyHopeConfig> {
  const config = await ensureAppConfig();
  return {
    postingEnabled: config.hourlyHopePostingEnabled,
    visible: config.hourlyHopeVisible,
  };
}

export async function updateHourlyHopeConfig(input: {
  postingEnabled?: boolean;
  visible?: boolean;
}): Promise<HourlyHopeConfig> {
  const current = await ensureAppConfig();

  const nextPostingEnabled =
    typeof input.postingEnabled === 'boolean'
      ? input.postingEnabled
      : current.hourlyHopePostingEnabled;

  const nextVisible =
    typeof input.visible === 'boolean' ? input.visible : current.hourlyHopeVisible;

  const updated = await prisma.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    update: {
      hourlyHopePostingEnabled: nextPostingEnabled,
      hourlyHopeVisible: nextVisible,
      hourlyHopeEnabled: nextPostingEnabled && nextVisible,
    },
    create: {
      id: APP_CONFIG_ID,
      hourlyHopePostingEnabled: nextPostingEnabled,
      hourlyHopeVisible: nextVisible,
      hourlyHopeEnabled: nextPostingEnabled && nextVisible,
    },
  });

  return {
    postingEnabled: updated.hourlyHopePostingEnabled,
    visible: updated.hourlyHopeVisible,
  };
}
