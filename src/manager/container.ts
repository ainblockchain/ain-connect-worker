import { Mutex, MutexInterface } from 'async-mutex';
// import k8s from '../util/k8s';
import * as constants from '../common/constants';


const mutex = new Mutex();

export default class Container {
  private static instance: Container;

  private containerInfoRelease: MutexInterface.Releaser;

  private containerDict: {[containerId: string]: {terminateTime: number}};


  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  constructor() {
    this.containerDict = {};
  }

  async start(containerId: string, publicKey: string,
    price: number, reserveAmount: number): Promise<number> {
    // mutex
    this.containerInfoRelease = await mutex.acquire();
    try {
      if (this.containerDict[containerId]) return 500;
      const containerCount = Object.keys(this.containerDict).length;
      if (containerCount > constants.MAX_CONTAINER_COUNT) return 500;
      this.containerDict[containerId] = {
        terminateTime: Date.now() / 1000 + (reserveAmount / price),
      };
    } finally {
      this.containerInfoRelease();
    }

    try {
      // const result = await k8s.create(containerId);
      return 0;
    } catch (error) {
      await this.terminate(containerId);
      return (constants.ERROR_MESSAGE[error]) ? error : 500;
    }
  }

  async terminate(containerId: string): Promise<number> {
    // mutex
    this.containerInfoRelease = await mutex.acquire();
    try {
      if (!this.containerDict[containerId]) return 510;
      delete this.containerDict[containerId];
    } finally {
      this.containerInfoRelease();
    }

    try {
      // await k8s.delete(containerId);
      return 0;
    } catch (error) {
      return (constants.ERROR_MESSAGE[error]) ? error : 500;
    }
  }

  extend(containerId: string, price: number, reserveAmount: number): number {
    if (this.containerDict[containerId] === undefined) return 1;
    this.containerDict[containerId].terminateTime += (reserveAmount / price);
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
    this.containerInfoRelease = await mutex.acquire();
    try {
      const containerCount = Object.keys(this.containerDict).length;
      return containerCount < constants.MAX_CONTAINER_COUNT;
    } finally {
      this.containerInfoRelease();
    }
  }

  getTerminateContainers(): string[] {
    const currentTime = Date.now() / 1000;
    const terminateContainers: string[] = [];
    Object.keys(this.containerDict).forEach((containerId: string) => {
      if (this.containerDict[containerId].terminateTime <= currentTime) {
        terminateContainers.push(containerId);
      }
    });
    return terminateContainers;
  }
}
