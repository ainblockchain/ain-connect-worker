import * as firebase from 'firebase/app';
import * as constants from '../common/constants';
import Logger from '../common/logger';
import Container from '../manager/container';
import encryptionHelper from '../util/encryption';
import k8s from '../util/k8s';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/functions';

const log = Logger.createLogger('handler.manager');

export default class Manager {
  static instance: Manager;

  // single tone
  static getInstance() {
    if (Manager.instance === undefined) {
      Manager.instance = new Manager();
    }
    return Manager.instance;
  }

  async start() {
    try {
      const result = await k8s.init();
      if (!result) {
        throw new Error('falied to init kubernetes');
      }
      log.info('[+] succeeded to init kubernetes');
      firebase.initializeApp(constants.firebaseConfig);
      const listener = firebase.firestore().collection(`cluster_list/${constants.CLUSTER_KEY}/request_queue`);
      listener.onSnapshot(this.createEvent);
      this.checkContainers();
      log.info(`[+] start to listen on Manager firestore [Cluster Key: ${constants.CLUSTER_KEY}]`);
    } catch (error) {
      throw new Error(`<manager> ${error}`);
    }
  }

  public createEvent = async (
    docSnapshot: firebase.firestore.QuerySnapshot<firebase.firestore.DocumentData>) => {
    docSnapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const requestId: string = change.doc.id;
        const params = change.doc.data();
        const {
          containerId, address, price, reserveAmount, type,
        } = params;
        log.debug(`[+] requested <type: ${type}, address: ${address} requestId: ${requestId}>`);
        const container = Container.getInstance();
        try {
          if (type === 'ADD') {
            await container.start(containerId, address, price!, reserveAmount!);
          } else if (type === 'TERMINATE') {
            await container.terminate(containerId);
          } else if (type === 'EXTEND') {
            await container.extend(containerId, price!, reserveAmount!);
          } else {
            throw new Error('4');
          }

          const resMassage = encryptionHelper.signatureMessage(
            { clusterKey: constants.CLUSTER_KEY, requestId, success: '0' },
            constants.CLUSTER_ADDR, constants.SECRET_KEY,
          );
          await firebase.functions().httpsCallable('requestContainerResponse')(resMassage);
          log.debug(`[+] succeded to ${type} <publicKey: ${address}>`);
        } catch (error) {
          const errCode = (constants.ERROR_MESSAGE[error]) ? error : 500;
          const resMassage = encryptionHelper.signatureMessage(
            {
              clusterKey: constants.CLUSTER_KEY,
              requestId,
              errCode,
              errMessage: constants.ERROR_MESSAGE[errCode],
            },
            constants.CLUSTER_ADDR, constants.SECRET_KEY,
          );
          await firebase.functions().httpsCallable('requestContainerResponse')(resMassage);
          log.debug(`[+] failed to ${type} <publicKey: ${address}> - ${error}`);
        }
      }
    });
  }

  private checkContainers() {
    setInterval(async () => {
      const container = Container.getInstance();
      const terminateContainers = container.getTerminateContainers();
      terminateContainers.forEach(async (containerInfo) => {
        log.debug(`[+] terminate <containerId: ${containerInfo.containerId}>`);
        await container.terminate(containerInfo.containerId);
        const resMassage = encryptionHelper.signatureMessage(
          { address: containerInfo.address, containerId: containerInfo.containerId },
          constants.CLUSTER_ADDR, constants.SECRET_KEY,
        );
        await firebase.functions().httpsCallable('expireContainer')(resMassage);
      });
    }, 1000);
  }
}
