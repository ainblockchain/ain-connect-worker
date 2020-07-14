import * as WebSocket from 'ws';
import axios from 'axios';
import Logger from '../common/logger';

const log = Logger.createLogger('jsonRpc.index');

export interface SubscriptionSuccess {
  subscriptionId: string;
}

export interface SubscriptionFailure {
  name: string;
  code: number;
  message: string;
}

export interface SubscriptionMessage {
  jsonrpc: '2.0';
  method?: string;
  result?: SubscriptionSuccess;
  error?: SubscriptionFailure;
  id?: string;
  params?: Request;
}

export interface Request {
  subscription: string;
  result: object;
}

export default class ClientJsonRpc {
  private events: {[subscriptionId: string]: Function };

  private rpcId: number;

  private address: string;

  private socket: WebSocket;

  private promiseDict: {[id: string]: {resolve: any, reject: any, timeout: NodeJS.Timeout }}

  /**
   * Instantiate a Client class.
   * @constructor
   * @param {String} address - url to a server
   * @param {Boolean} ws - websocket
   * @return {Undefined}
   */
  constructor(address: string, socket?: WebSocket) {
    this.rpcId = 0;
    this.address = address;
    if (socket) {
      this.socket = socket;
      this.addEvent();
    }
    this.promiseDict = {};
    this.events = {};
  }

  /**
   * Connects to a defined server if not connected already.
   * @method
   * @param {String} address - url to a server
   * @param {WebSocket.ClientOptions} options - ws options object with reconnect parameters
   * @return {Undefined}
   */
  private addEvent() {
    this.socket.on('message', async (data: Buffer) => {
      try {
        const message: SubscriptionMessage = JSON.parse(data.toString());
        if (message.method) {
          await this.requestHandler(message);
        } else if (message.id) {
          this.promiseDict[message.id].resolve(message.result);
          delete this.promiseDict[message.id];
        }
      } catch (e) {
        log.error(`addEvent.message  ${e}`);
      }
    });
  }

  private async requestHandler(message: SubscriptionMessage) {
    if (message.method === 'tx_subscription' && message.params) {
      try {
        await this.events[message.params.subscription](message.params.result);
      } catch (error) {
        log.error(`<requestHandler> - ${error}`);
      }
    }
  }

  /**
   * Calls a registered RPC method on server.
   * @param {String} method - RPC method name
   * @param {Object|Array} params - optional method parameters
   * @param {Numberprivate} timeout - RPC reply timeout value
   * @return {Promise}
   */
  public call(method: string, params?: Object | [],
    notify: boolean = false, timeout: number = 0): Promise<any> {
    const id = (this.rpcId + 1) % 2000000000;
    this.rpcId = id;
    const message = {
      jsonrpc: '2.0',
      method,
      params: params || null,
      id: (notify) ? undefined : id,
    };

    if (this.socket) {
      return new Promise<any>((resolve, reject) => {
        this.socket.send(JSON.stringify(message));
        if (!notify) {
          const nodejsTimeout = setTimeout(() => {
            delete this.promiseDict[id];
            reject(new Error('reply timeout'));
          }, (timeout !== 0) ? timeout : 30000);
          this.promiseDict[id] = { resolve, reject, timeout: nodejsTimeout };
        } else {
          resolve(0);
        }
      });
    }
    return new Promise<any>((resolve, reject) => {
      axios.post(this.address, message, { timeout })
        .then((result) => resolve(result))
        .catch((error) => reject(error));
    });
  }

  /**
   * Sends a JSON-RPC 2.0 notification to server.
   * @method
   * @param {String} method - RPC method name
   * @param {String|Array} params - optional method parameters
   * @return {Promise}
   * @throws {Error}
   */
  public async notify(method: string, params?: Object | []): Promise<boolean> {
    if (!this.socket) {
      return Promise.reject(new Error('socket not ready'));
    }
    await this.call(method, params, true)
      .catch((error) => Promise.reject(error));

    return true;
  }

  /**
   * Subscribes for a defined event.
   * @method
   * @param {String} method - RPC method name
   * @param {Object|Array} call - optional method parameters
   * @param {Object|Array} params - optional method parameters
   * @param {Number} timeout - RPC reply timeout value
   * @return {Promise}
   * @throws {Error}
   */
  public async subscribe(method: string,
    call: any, params?: Object | [], timeout: number = 0): Promise<string> {
    if (!this.socket) {
      return Promise.reject(new Error('socket not ready'));
    }
    try {
      const result = await this.call(method, params, false, timeout);
      if (result.error) {
        throw new Error('failed to subscribe.');
      }
      this.events[result.subscriptionId] = call;
      return result.subscriptionId;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Unsubscribes from a defined event.
   * @param {String} method - RPC method name
   * @param {String} subscriptionId - subscription Id
   * @param {number} timeout - timeout
   * @return {Promise}
   * @throws {Error}
   */
  public async unsubscribe(method: string, subscriptionId: string,
    timeout: number = 0): Promise<boolean> {
    try {
      if (!this.events[subscriptionId]) {
        return Promise.reject(new Error('does not exist event'));
      }
      await this.call(method, { subscriptionId }, true, timeout);
      delete this.events[subscriptionId];
      return true;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Closes a WebSocket connection gracefully.
   * @method
   * @return {Undefined}
   */
  public close() {
    this.socket.close();
  }
}
