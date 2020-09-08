import * as program from 'commander';
import * as constants from './common/constants';
import Logger from './common/logger';
import WorkerManager from './manager/workerManager';

const log = Logger.createLogger('index');

program.version(constants.VERSION!);

program.command('start').action(async () => {
  try {
    const workerManager = new WorkerManager(
      constants.CLUSTER_NAME!, constants.MNEMONIC!, constants.NODE_ENV as 'staging' | 'prod',
    );
    await workerManager.start();
  } catch (error) {
    log.error(`[-] ${error}`);
    process.exit(1);
  }
});

program.parse(process.argv);
