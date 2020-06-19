import * as program from 'commander';
import * as express from 'express';
import * as constants from './common/constants';
import Logger from './common/logger';
import Manager from './handler/manager';
import Tracker from './handler/tracker';

const log = Logger.createLogger('index');

// for Health Check
const app = express();
app.get('/health', (_, res) => {
  res.send('ok');
});
app.listen(constants.HEALTH_PORT, '0.0.0.0', () => {
  log.info('[+] started to listen for checking health');
});

program.version(constants.VERSION!);

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
