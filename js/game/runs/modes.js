import { DeliveryRun } from './DeliveryRun.js';
import { DailyRun } from './DailyRun.js';
import { MissionRun } from './MissionRun.js';
import { FreeFlight } from './FreeFlight.js';
import { FreeDrive } from './FreeDrive.js';

/**
 * Which kind of run a set of options asks for. opts: { free } free flight · { drive: 'car' | 'boat', take } free drive
 * or sail · { mission } a mission (see Missions.js) · { daily } today's challenge · {} a courier run.
 * A new kind of run is a Run subclass (see Run.js) and a line here.
 */
export function runClass(opts = {}) {
  if (opts.free) return FreeFlight;
  if (opts.drive) return FreeDrive;
  if (opts.mission) return MissionRun;
  if (opts.daily) return DailyRun;
  return DeliveryRun;
}
