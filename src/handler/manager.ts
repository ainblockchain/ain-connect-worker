import * as firebase from 'firebase/app';
import * as constants from '../common/constants';
import Logger from '../common/logger';
import Service from '../manager/service';
import encryptionHelper from '../util/encryption';
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

  start() {
    firebase.initializeApp(constants.firebaseConfig);
    const listener = firebase.firestore().collection(`worker_list/${constants.WORKER_ADDR}/request_queue`);
    listener.onSnapshot(this.createEvent);
    this.checkServices();
    log.info(`[+] start to listen on Manager firestore [Worker Key: ${constants.WORKER_KEY}]`);
  }

  public createEvent = async (
    docSnapshot: firebase.firestore.QuerySnapshot<firebase.firestore.DocumentData>) => {
    docSnapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const requestId: string = change.doc.id;
        const params = change.doc.data();
        const {
          serviceId, address, price, reserveAmount, type,
        } = params;
        log.debug(`[+] requested <type: ${type}, address: ${address}>`);
        const service = Service.getInstance();
        try {
          if (type === 'ADD') {
            await service.start(serviceId, address, price!, reserveAmount!);
          } else if (type === 'TERMINATE') {
            await service.terminate(serviceId);
          } else if (type === 'EXTEND') {
            await service.extend(serviceId, price!, reserveAmount!);
          } else {
            throw new Error('4');
          }

          const resMassage = encryptionHelper.signatureMessage(
            { workerKey: constants.WORKER_ADDR, requestId, success: '0' },
            constants.WORKER_ADDR, constants.SECRET_KEY,
          );
          await firebase.functions().httpsCallable('requestServiceResponse')(resMassage);
          log.debug(`[+] succeded to ${type} <publicKey: ${address}>`);
        } catch (error) {
          const errCode = (constants.ERROR_MESSAGE[error]) ? error : 500;
          const resMassage = encryptionHelper.signatureMessage(
            {
              workerKey: constants.WORKER_ADDR,
              requestId,
              errCode,
              errMessage: constants.ERROR_MESSAGE[errCode],
            },
            constants.WORKER_ADDR, constants.SECRET_KEY,
          );
          await firebase.functions().httpsCallable('requestServiceResponse')(resMassage);
          log.debug(`[+] failed to ${type} <publicKey: ${address}> - ${error}`);
        }
      }
    });
  }

  private checkServices() {
    setInterval(async () => {
      const service = Service.getInstance();
      const terminateServices = service.getTerminateServices();
      terminateServices.forEach(async (serviceId: string) => {
        log.debug(`[+] terminate <serviceId: ${serviceId}>`);
        await service.terminate(serviceId);
        const resMassage = encryptionHelper.signatureMessage(
          { workerKey: constants.WORKER_ADDR, requestId: 'requestId', success: 0 },
          constants.WORKER_ADDR, constants.SECRET_KEY,
        );
        await firebase.functions().httpsCallable('requestServiceResponse')(resMassage);
      });
    }, 1000);
  }
}
