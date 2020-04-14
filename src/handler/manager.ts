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

  private listener: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>

  private unsubscribe: any;

  private eventDict: {[requestId: string]: {status: boolean}};

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
      this.eventDict = {};
      if (!result) {
        throw new Error('falied to init kubernetes');
      }
      log.info('[+] succeeded to init kubernetes');
      firebase.initializeApp(constants.firebaseConfig);
      this.listener = firebase.firestore().collection(`cluster_list/${constants.CLUSTER_KEY}/request_queue`);
      this.unsubscribe = this.listener.onSnapshot({
        next: this.createEvent,
        error: (error) => {
          log.error(`[-] Listener Error - ${error}`);
        },
      });
      log.info(`[+] start to listen on Manager firestore [Cluster Key: ${constants.CLUSTER_KEY}]`);
      setInterval(() => {
        this.unsubscribe();
        this.listener = firebase.firestore().collection(`cluster_list/${constants.CLUSTER_KEY}/request_queue`);
        this.unsubscribe = this.listener.onSnapshot({
          next: this.createEvent,
          error: (error) => {
            log.error(`[-] Listener Error - ${error}`);
          },
        });
      }, constants.INTERVAL_MS);
    } catch (error) {
      throw new Error(`<manager> ${error}`);
    }
  }

  public createEvent = async (
    docSnapshot: firebase.firestore.QuerySnapshot<firebase.firestore.DocumentData>) => {
    await docSnapshot.docChanges().forEach(async (change) => {
      log.debug(`[+] ${change.type} requestId: ${change.doc.id}`);
      if (change.type === 'added') {
        const requestId: string = change.doc.id;
        const params = change.doc.data();
        const {
          containerId, address, price, reserveAmount, type,
        } = params;
        if (this.eventDict[requestId]) {
          return;
        }
        log.debug(`[+] requested <type: ${type}, address: ${address} requestId: ${requestId} containerId: ${containerId}>`);
        const container = Container.getInstance();
        this.eventDict[requestId] = { status: true };
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
          delete this.eventDict[requestId];
          log.debug(`[+] succeeded to ${type} <publicKey: ${address}>`);
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
          try {
            await firebase.functions().httpsCallable('requestContainerResponse')(resMassage);
          } catch (e) {
            log.error(`[-] failed to call functions - ${e}`);
          }
          delete this.eventDict[requestId];
          log.debug(`[+] failed to ${type} <publicKey: ${address}> - ${error}`);
        }
      }
    });
  }
}
