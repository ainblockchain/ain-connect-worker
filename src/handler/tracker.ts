import ClientJsonRpc from '../jsonRpc/index';
import * as constants from '../common/constants';
import encryptionHelper from '../util/encryption';
import Logger from '../common/logger';
import Container from '../manager/container';

const log = Logger.createLogger('handler.tracker');

export default class Tracker {
  private static rpcManager: ClientJsonRpc = new ClientJsonRpc(`https://${constants.SERVER_ADDR}/tracker`);

  static async start() {
    try {
      const clusterInfo = {
        address: constants.CLUSTER_ADDR,
        clusterName: constants.CLUSTER_NAME,
        description: constants.DESCRIPTION,
        priceBySec: constants.PRICE,
      };
      const ready = await Container.getInstance().getReadyInfo();
      const clusterSpec = {
        cpu: constants.CPU_LIMIT,
        gpu: constants.GPU_LIMIT || '0',
        memory: constants.MEMORY_LIMIT,
        storage: constants.STORAGE_LIMIT,
        image: constants.IMAGE,
      };
      const registerParams = encryptionHelper.signatureMessage(
        {
          ready: Number(ready),
          clusterKey: constants.CLUSTER_KEY,
          version: constants.VERSION,
          clusterSpec: JSON.stringify(clusterSpec),
          clusterInfo: JSON.stringify(clusterInfo),
        },
        constants.CLUSTER_ADDR, constants.SECRET_KEY,
      );
      const registerResult = await this.rpcManager.call('ain_registerCluster', registerParams);
      if (!registerResult.data.result.success) {
        throw JSON.stringify(registerResult.data);
      }
      setInterval(async () => {
        const healthReedy = await Container.getInstance().getReadyInfo();
        const healthParams = encryptionHelper.signatureMessage(
          { clusterKey: constants.CLUSTER_KEY, ready: Number(healthReedy) },
          constants.CLUSTER_ADDR, constants.SECRET_KEY,
        );
        await this.rpcManager.call('ain_healthCheck', healthParams);
      }, constants.TRACKER_HEALTH_MS);
    } catch (error) {
      log.error(`[-] ${error}`);
    }
    log.info('[+] start to connect on Tracker');
  }
}
