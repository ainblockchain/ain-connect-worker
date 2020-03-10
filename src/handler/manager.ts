import * as firebase from 'firebase/app';
import * as constants from '../common/constants';
import * as types from '../common/types';
import Logger from '../common/logger';
import Service from '../manager/service';
import encryptionHelper from '../util/encryption';
import 'firebase/database';
import 'firebase/auth';
import 'firebase/functions';

const log = Logger.createLogger('handler.manager');
const NOT_AUTH_MESSAGE = 'there is no uid.';

export default class Manager {
  static instance: Manager;

  // single tone
  static getInstance() {
    if (Manager.instance === undefined) {
      Manager.instance = new Manager();
    }
    return Manager.instance;
  }

  start() {
    firebase.initializeApp(constants.firebaseConfig);
    firebase.auth().signInWithEmailAndPassword(constants.FIREBASE_EMAIL!,
      constants.FIREBASE_PWD!).then(async (credential) => {
      const uid = credential.user!.uid || undefined;
      if (uid === undefined || uid === null) {
        throw NOT_AUTH_MESSAGE;
      }
      const listener = firebase.database().ref(`worker_list/${uid}/request_queue`);
      listener.on('child_added', this.createEvent(uid));
      this.checkSerices(uid);
      log.info(`[+] start to listen on Manager DB [uid: ${uid}]`);
    });
  }

  private createEvent = (uid: string) => async (data: firebase.database.DataSnapshot) => {
    const requestId: string = data.key!;
    const params: types.Request = data.val();
    const {
      serviceId, publicKey, price, reserveAmount, type,
    } = params;

    log.debug(`[+] requested <type: ${type}, publicKey: ${publicKey}>`);

    const service = Service.getInstance();
    try {
      if (type === 'ADD') {
        await service.start(serviceId, publicKey, price!, reserveAmount!);
      } else if (type === 'TERMINATE') {
        await service.terminate(serviceId);
      } else if (type === 'EXTEND') {
        await service.extend(serviceId, price!, reserveAmount!);
      } else {
        throw new Error('4');
      }
      const resMassage = encryptionHelper.signatureMessage(
        { workerKey: uid, requestId, success: 0 },
        constants.WORKER_ADDR, constants.SECRET_KEY,
      );
      await firebase.functions().httpsCallable('requestServiceResponse')(resMassage);
      log.debug(`[+] succeded to ${type} <publicKey: ${publicKey}>`);
    } catch (error) {
      const errCode = (constants.ERROR_MESSAGE[error]) ? error : 500;
      const resMassage = encryptionHelper.signatureMessage(
        {
          workerKey: uid,
          requestId,
          errCode,
          errMessage: constants.ERROR_MESSAGE[errCode],
        },
        constants.WORKER_ADDR, constants.SECRET_KEY,
      );
      await firebase.functions().httpsCallable('requestServiceResponse')(resMassage);
      log.debug(`[+] failed to ${type} <publicKey: ${publicKey}> - ${error}`);
    }
  }

  private checkSerices(uid: string) {
    setInterval(async () => {
      const service = Service.getInstance();
      const terminateServices = service.getTerminateServices();
      terminateServices.forEach(async (serviceId: string) => {
        log.debug(`[+] terminate <serviceId: ${serviceId}>`);
        await service.terminate(serviceId);
        const resMassage = encryptionHelper.signatureMessage(
          { workerKey: uid, requestId: 'requestId', success: 0 },
          constants.WORKER_ADDR, constants.SECRET_KEY,
        );
        await firebase.functions().httpsCallable('requestServiceResponse')(resMassage);
      });
    }, 1000);
  }
}
