import * as firebase from 'firebase/app';
import { Mutex, MutexInterface } from 'async-mutex';
import Logger from '../common/logger';
import k8s from '../util/k8s';
import encryptionHelper from '../util/encryption';
import * as constants from '../common/constants';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/functions';

const log = Logger.createLogger('manager.container');
const mutex = new Mutex();

export default class Container {
  private static instance: Container;

  private containerInfoRelease: MutexInterface.Releaser;

  private containerDict: {[containerId: string]:
    {address: string, timer?: any, terminateTime: number}};


  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  constructor() {
    this.containerDict = {};
  }

  async start(containerId: string, address: string,
    price: number, reserveAmount: number): Promise<number> {
    // mutex
    this.containerInfoRelease = await mutex.acquire();
    try {
      if (this.containerDict[containerId]) throw '550';
      const ready = await this.getReadyInfo();

      if (!ready) throw '540';
      this.containerDict[containerId] = {
        address,
        terminateTime: 0,
      };
    } finally {
      this.containerInfoRelease();
    }

    try {
      const result = await k8s.create(containerId, address);
      if (!result) {
        throw '500';
      }
      const ms = Math.floor(reserveAmount / price) * 1000;
      this.containerDict[containerId].timer = this.getTimeoutContainer(containerId, address, ms);
      this.containerDict[containerId].terminateTime = Date.now() / 1000 + ms;
      return 0;
    } catch (error) {
      await this.terminate(containerId);
      throw (constants.ERROR_MESSAGE[error]) ? error : '600';
    }
  }

  async terminate(containerId: string): Promise<number> {
    // mutex
    this.containerInfoRelease = await mutex.acquire();
    try {
      if (!this.containerDict[containerId]) return 510;
      clearTimeout(this.containerDict[containerId].timer);
      delete this.containerDict[containerId];
    } finally {
      this.containerInfoRelease();
    }

    try {
      await k8s.delete(containerId);
      return 0;
    } catch (error) {
      return (constants.ERROR_MESSAGE[error]) ? error : 500;
    }
  }

  extend(containerId: string, price: number, reserveAmount: number): number {
    if (this.containerDict[containerId] === undefined) return 1;
    this.containerDict[containerId].terminateTime += ((reserveAmount / price) * 1000);
    if (this.containerDict[containerId].timer) {
      clearTimeout(this.containerDict[containerId].timer);
    }
    const { address } = this.containerDict[containerId];
    const ms = this.containerDict[containerId].terminateTime - (Date.now() / 1000);
    this.containerDict[containerId].timer = this.getTimeoutContainer(containerId, address, ms);
    return 0;
  }

  async clean() {
    try {
      const promiseList: [Promise<number>?] = [];
      Object.keys(this.containerDict).forEach((containerId: string) => {
        promiseList.push(this.terminate(containerId));
      });
      await Promise.all(promiseList);
      return 0;
    } catch (e) {
      return 500;
    }
  }

  getcontainerCnt(): number {
    return Object.keys(this.containerDict).length;
  }

  async getReadyInfo() {
    const containerCount = Object.keys(this.containerDict).length;
    const result = await k8s.getReadyForCreate();
    return (containerCount < constants.MAX_CONTAINER_COUNT && result);
  }

  getTimeoutContainer(containerId: string, address: string, ms: number) {
    return setTimeout(async () => {
      log.debug(`[+] terminate <containerId: ${containerId}>`);
      await Container.getInstance().terminate(containerId);
      const resMassage = encryptionHelper.signatureMessage(
        { address, containerId },
        constants.CLUSTER_ADDR, constants.SECRET_KEY,
      );
      await firebase.functions().httpsCallable('expireContainer')(resMassage);
      log.debug(`[+] succeeded to terminate <containerId: ${containerId}>`);
    }, ms);
  }
}
