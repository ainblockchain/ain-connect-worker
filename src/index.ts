import * as program from 'commander';
import * as constants from './common/constants';
import Manager from './handler/manager';
import Tracker from './handler/tracker';

program.version(constants.VERSION);

program.command('start').action(() => {
  // @TODO check env
  Manager.getInstance().start();
  Tracker.start();
});

program.parse(process.argv);
