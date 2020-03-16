import * as program from 'commander';
import * as constants from './common/constants';
import Manager from './handler/manager';
import Tracker from './handler/tracker';

program.version(constants.VERSION);

program.command('start').action(async () => {
  await Manager.getInstance().start();
  await Tracker.start();
});

program.parse(process.argv);
