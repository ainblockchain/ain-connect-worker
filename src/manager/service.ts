import { Mutex, MutexInterface } from 'async-mutex';
// import k8s from '../util/k8s';
import * as constants from '../common/constants';


const mutex = new Mutex();

export default class Service {
  private static instance: Service;

  private serviceInfoRelease: MutexInterface.Releaser;

  private serviceDict: {[serviceId: string]: {terminateTime: number}};


  static getInstance(): Service {
    if (!Service.instance) {
      Service.instance = new Service();
    }
    return Service.instance;
  }

  constructor() {
    this.serviceDict = {};
  }

  async start(serviceId: string, publicKey: string,
    price: number, reserveAmount: number): Promise<number> {
    // mutex
    this.serviceInfoRelease = await mutex.acquire();
    try {
      if (this.serviceDict[serviceId]) return 500;
      const serviceCount = Object.keys(this.serviceDict).length;
      if (serviceCount > constants.MAX_SERVICE_COUNT) return 500;
      this.serviceDict[serviceId] = {
        terminateTime: Date.now() / 1000 + (reserveAmount / price),
      };
    } finally {
      this.serviceInfoRelease();
    }

    try {
      // const result = await k8s.create(serviceId);
      return 0;
    } catch (error) {
      await this.terminate(serviceId);
      return (constants.ERROR_MESSAGE[error]) ? error : 500;
    }
  }

  async terminate(serviceId: string): Promise<number> {
    // mutex
    this.serviceInfoRelease = await mutex.acquire();
    try {
      if (!this.serviceDict[serviceId]) return 510;
      delete this.serviceDict[serviceId];
    } finally {
      this.serviceInfoRelease();
    }

    try {
      // await k8s.delete(serviceId);
      return 0;
    } catch (error) {
      return (constants.ERROR_MESSAGE[error]) ? error : 500;
    }
  }

  extend(serviceId: string, price: number, reserveAmount: number): number {
    if (this.serviceDict[serviceId] === undefined) return 1;
    this.serviceDict[serviceId].terminateTime += (reserveAmount / price);
    return 0;
  }

  async clean() {
    try {
      const promiseList: [Promise<number>?] = [];
      Object.keys(this.serviceDict).forEach((serviceId: string) => {
        promiseList.push(this.terminate(serviceId));
      });
      await Promise.all(promiseList);
      return 0;
    } catch (e) {
      return 500;
    }
  }

  getserviceCnt(): number {
    return Object.keys(this.serviceDict).length;
  }

  getTerminateServices(): string[] {
    const currentTime = Date.now() / 1000;
    const terminateServices: string[] = [];
    Object.keys(this.serviceDict).forEach((serviceId: string) => {
      if (this.serviceDict[serviceId].terminateTime <= currentTime) {
        terminateServices.push(serviceId);
      }
    });
    return terminateServices;
  }
}
