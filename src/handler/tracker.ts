import axios from 'axios';
import * as constants from '../common/constants';
import Logger from '../common/logger';

const log = Logger.createLogger('handler.tracker');

const FAILED_ERROR = 'failed to register';

export default class Tracker {
  static async start() {
    try {
      // @TODO send worker info + serice status
      const registerResult = await axios.post(`https://${constants.SERVER_ADDR}/register`, {});
      if (registerResult.data!.result !== 0) {
        throw FAILED_ERROR;
      }
      setTimeout(async () => {
        // @TODO send serive status
        await axios.post(`https://${constants.SERVER_ADDR}/ping`, {});
      });
    } catch (error) {
      log.error(`[-] ${error}`);
    }
  }
}
