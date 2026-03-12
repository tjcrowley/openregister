import type { IHardwareDriver } from '@openregister/providers';

class HardwareRegistry {
  private drivers = new Map<string, IHardwareDriver>();

  register(name: string, driver: IHardwareDriver): void {
    this.drivers.set(name, driver);
  }

  get(name: string): IHardwareDriver | undefined {
    return this.drivers.get(name);
  }

  listAll(): Array<{ name: string; driver: IHardwareDriver }> {
    return Array.from(this.drivers.entries()).map(([name, driver]) => ({ name, driver }));
  }
}

export const hardwareRegistry = new HardwareRegistry();
