import { DeliveryRun } from './DeliveryRun.js';
import { DailyRun } from './DailyRun.js';
import { MissionRun } from './MissionRun.js';
import { FreeFlight } from './FreeFlight.js';
import { FreeDrive } from './FreeDrive.js';
import { TaxiRun } from './TaxiRun.js';
import { VanRun } from './VanRun.js';
import { RaceRun } from './RaceRun.js';

const ROAD = { taxi: TaxiRun, van: VanRun, race: RaceRun };

/**
 * Which kind of run a set of options asks for. opts: { free } free flight · { drive: 'car' | 'boat', take } free drive
 * or sail · { road: 'taxi' | 'van' | 'race' } a road trip · { mission } a mission (see Missions.js) · { daily } today's
 * challenge · {} a courier run. A new kind of run is a Run subclass (see Run.js) and a line here.
 */
export function runClass(opts = {}) {
  if (opts.free) return FreeFlight;
  if (opts.drive) return FreeDrive;
  if (ROAD[opts.road]) return ROAD[opts.road];
  if (opts.mission) return MissionRun;
  if (opts.daily) return DailyRun;
  return DeliveryRun;
}
