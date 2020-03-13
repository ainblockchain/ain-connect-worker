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
        ClusterName: constants.CLUSTER_NAME,
        description: constants.DESCRIPTION,
        priceBySec: constants.PRICE,
      };

      const clusterSpec = {
        cpu: constants.CPU,
        gpu: constants.GPU,
        memory: constants.MEMORY,
        storage: constants.STORAGE,
        image: constants.IMAGE,
      };
      const registerParams = encryptionHelper.signatureMessage(
        {
          clusterKey: constants.CLUSTER_ADDR,
          version: constants.VERSION,
          clusterSpec: JSON.stringify(clusterSpec),
          clusterInfo: JSON.stringify(clusterInfo),
        },
        constants.CLUSTER_ADDR, constants.SECRET_KEY,
      );
      const registerResult = await this.rpcManager.call('ain_registerCluster', registerParams);
      if (registerResult.data.result !== 0) {
        throw JSON.stringify(registerResult.data.error);
      }
      setTimeout(async () => {
        const ready = await Container.getInstance().getReadyInfo();
        const healthParams = encryptionHelper.signatureMessage(
          { clusterKey: constants.CLUSTER_ADDR, ready },
          constants.CLUSTER_ADDR, constants.SECRET_KEY,
        );
        await this.rpcManager.call('ain_healthCheck', healthParams);
      });
    } catch (error) {
      log.error(`[-] ${error}`);
    }
    log.info('[+] start to connect on Tracker');
  }
}
