import * as firebase from 'firebase/app';
import * as constants from '../common/constants';
import {
  CustomError, STATUS_CODE, errorCategoryInfo, errorMessage,
} from '../common/error';
import Logger from '../common/logger';
import encryptionHelper from '../util/encryption';
import k8s from '../util/k8s';
import '@firebase/firestore';
import '@firebase/auth';
import '@firebase/functions';

const log = Logger.createLogger('handler.manager');


export default class Manager {
  static instance: Manager;

  static listenPath: string = `cluster_list/${constants.CLUSTER_KEY}/request_queue`;

  private listener: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>

  private unsubscribe: any;

  // single tone
  static getInstance() {
    if (Manager.instance === undefined) {
      Manager.instance = new Manager();
    }
    return Manager.instance;
  }

  async start() {
    try {
      firebase.initializeApp(constants.firebaseConfig);
      this.listener = firebase.firestore().collection(Manager.listenPath);
      this.unsubscribe = this.listener.onSnapshot({
        next: this.listenEvent,
        error: (error) => {
          log.error(`[-] Listener Error - ${error}`);
        },
      });
      log.info(`[+] Started to listen on Manager firestore [Cluster Key: ${constants.CLUSTER_KEY}]`);
      setInterval(() => {
        this.unsubscribe();
        this.listener = firebase.firestore().collection(Manager.listenPath);
        this.unsubscribe = this.listener.onSnapshot({
          next: this.listenEvent,
          error: (error) => {
            log.error(`[-] Listener Error - ${error}`);
          },
        });
      }, constants.INTERVAL_MS);
    } catch (error) {
      throw new Error(`<manager> ${error}`);
    }
  }

  public listenEvent = async (
    docSnapshot: firebase.firestore.QuerySnapshot<firebase.firestore.DocumentData>) => {
    await docSnapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const requestId: string = change.doc.id;
        const params = change.doc.data();
        const {
          address, kubectl_cmd, type,
        } = params;

        log.debug(`[+] Requested <type: ${type}, address: ${address} requestId: ${requestId}>`);
        try {
          if (type !== 'AINIZE') {
            throw new CustomError(errorCategoryInfo.runCommand,
              STATUS_CODE.invalidParams, errorMessage[STATUS_CODE.invalidParams]);
          }

          const result = await k8s.runCommand(kubectl_cmd);

          const resMassage = encryptionHelper.signatureMessage(
            { clusterKey: constants.CLUSTER_KEY, requestId, ...result },
            constants.CLUSTER_ADDR, constants.SECRET_KEY,
          );
          await firebase.functions().httpsCallable('submitAinizeResponse')(resMassage);
          log.debug(`[+] Succeeded <type: ${type}, address: ${address} requestId: ${requestId}>`);
        } catch (error) {
          const errorObject = (error instanceof CustomError)
            ? error : new CustomError(errorCategoryInfo.runCommand,
              STATUS_CODE.Unexpected, JSON.stringify(error));

          const { statusCode, message } = errorObject.getInfo();
          const resMassage = encryptionHelper.signatureMessage(
            {
              clusterKey: constants.CLUSTER_KEY,
              requestId,
              status_code: statusCode,
              errMessage: message,
            },
            constants.CLUSTER_ADDR, constants.SECRET_KEY,
          );
          try {
            await firebase.functions().httpsCallable('submitAinizeResponse')(resMassage);
          } catch (e) {
            log.error(`[-] Failed to call functions - ${e}`);
          }
        }
      }
    });
  }
}
