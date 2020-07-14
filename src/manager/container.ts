import * as firebase from 'firebase/app';
import { Mutex, MutexInterface } from 'async-mutex';
import Logger from '../common/logger';
import k8s from '../util/k8s';
import encryptionHelper from '../util/encryption';
import * as constants from '../common/constants';
import { CustomError, STATUS_CODE, errorCategoryInfo } from '../common/error';
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

  async create(containerId: string, address: string,
    price: number, reserveAmount: number): Promise<string> {
    // Mutex(1):start
    this.containerInfoRelease = await mutex.acquire();
    try {
      if (this.containerDict[containerId]) {
        throw new CustomError(errorCategoryInfo.createContainer, STATUS_CODE.alreadyExists);
      }
      const ready = await this.getReadyInfo();
      if (!ready) {
        throw new CustomError(errorCategoryInfo.createContainer, STATUS_CODE.notReady);
      }
      this.containerDict[containerId] = {
        address,
        terminateTime: 0,
      };
    } finally {
      this.containerInfoRelease();
    }
    // Mutex(1):end

    try {
      const result = await k8s.createContainer(containerId, address);
      if (!result) {
        throw new CustomError(errorCategoryInfo.createContainer, STATUS_CODE.timeout);
      }
      const reserveTimeMs = Math.floor(reserveAmount / price) * 1000;
      this.containerDict[containerId].timer = this.getTimeoutContainer(
        containerId, address, reserveTimeMs,
      );
      this.containerDict[containerId].terminateTime = Date.now() / 1000 + reserveTimeMs;
      return STATUS_CODE.success;
    } catch (error) {
      await this.delete(containerId);
      throw (error instanceof CustomError)
        ? error : new CustomError(errorCategoryInfo.createContainer,
          STATUS_CODE.Unexpected, JSON.stringify(error));
    }
  }

  async delete(containerId: string): Promise<string> {
    // Mutex(1):start
    this.containerInfoRelease = await mutex.acquire();
    try {
      if (!this.containerDict[containerId]) {
        throw new CustomError(errorCategoryInfo.deleteContainer, STATUS_CODE.notExists);
      }
      clearTimeout(this.containerDict[containerId].timer);
      delete this.containerDict[containerId];
    } finally {
      this.containerInfoRelease();
    }
    // Mutex(1):end

    try {
      await k8s.deleteContainer(containerId);
      return STATUS_CODE.success;
    } catch (error) {
      throw (error instanceof CustomError)
        ? error : new CustomError(errorCategoryInfo.createContainer,
          STATUS_CODE.Unexpected, JSON.stringify(error));
    }
  }

  extend(containerId: string, price: number, reserveAmount: number): string {
    if (this.containerDict[containerId] === undefined) return STATUS_CODE.notExists;
    this.containerDict[containerId].terminateTime += ((reserveAmount / price) * 1000);
    if (this.containerDict[containerId].timer) {
      clearTimeout(this.containerDict[containerId].timer);
    }
    const { address } = this.containerDict[containerId];
    const reserveTimeMs = this.containerDict[containerId].terminateTime - (Date.now() / 1000);
    this.containerDict[containerId].timer = this.getTimeoutContainer(
      containerId, address, reserveTimeMs,
    );
    return STATUS_CODE.success;
  }

  async clean() {
    try {
      const promiseList: [Promise<string>?] = [];
      Object.keys(this.containerDict).forEach((containerId: string) => {
        promiseList.push(this.delete(containerId));
      });
      await Promise.all(promiseList);
      return STATUS_CODE.success;
    } catch (e) {
      return STATUS_CODE.Unexpected;
    }
  }

  getcontainerCnt(): number {
    return Object.keys(this.containerDict).length;
  }

  async getReadyInfo() {
    const containerCount = this.getcontainerCnt();
    const result = await k8s.getReadyForCreate();
    return (containerCount < constants.CONTAINER_COUNT_LIMIT && result);
  }

  getTimeoutContainer(containerId: string, address: string, reserveTimeMs: number) {
    return setTimeout(async () => {
      log.debug(`[+] terminate:timeout <containerId: ${containerId}>`);
      await Container.getInstance().delete(containerId);
      const resMassage = encryptionHelper.signatureMessage(
        { address, containerId },
        constants.CLUSTER_ADDR, constants.SECRET_KEY,
      );
      await firebase.functions().httpsCallable('expireContainer')(resMassage);
      log.debug(`[+] succeeded to terminate:timeout <containerId: ${containerId}>`);
    }, reserveTimeMs);
  }
}
