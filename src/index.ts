import * as program from 'commander';
import * as constants from './common/constants';
import Logger from './common/logger';
import Manager from './handler/manager';
import Tracker from './handler/tracker';

const log = Logger.createLogger('index');


program.version(constants.VERSION);

program.command('start').action(async () => {
  try {
    await constants.checkConstants();
    await Manager.getInstance().start();
    await Tracker.start();
  } catch (error) {
    log.error(`[-] ${error}`);
    process.exit(1);
  }
});

program.parse(process.argv);
