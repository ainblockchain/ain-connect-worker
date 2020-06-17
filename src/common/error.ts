export const enum STATUS_CODE {
  success = '0',
  timeout = '1',
  invalidParams = '2',
  notReady = '3',
  alreadyExists = '4',
  notExists = '5',
  failedToInitK8s = '6',
  callError = '7',
  Unexpected = '500',
}

export const errorCategoryInfo = {
  // Container
  createContainer: 'failed to create container.',
  deleteContainer: 'failed to delete container.',
  extendContainer: 'falied to extend reserve amount.',
  // Tracker
  registerTracker: 'failed to register',
  // Manager
  startManager: 'failed to listen to firestore',
  eventManager: 'event error',
};

export const errorMessage = {
  1: 'process time out.',
  2: 'it is invalid parameter.',
  3: 'it is not ready yet.',
  4: 'it is already exists.',
  5: 'it is not exists.',
  6: 'failed to initialize k8s',
  7: 'failed to call functions',
  500: 'it is unexpected result.',
};

export class CustomError extends Error {
  constructor(private category: string, private statusCode: string, message?: string) {
    super();
    this.name = 'CustomError';
    this.statusCode = (errorMessage[statusCode]) ? statusCode : '500';
    this.message = message || errorMessage[this.statusCode];
  }

  showAlert() {
    return `${errorCategoryInfo[this.category]}:${this.statusCode} [detail: ${this.message}]`;
  }

  getInfo() {
    return {
      categoryMessage: errorCategoryInfo[this.category],
      statusCode: this.statusCode,
      message: this.message,
    };
  }
}
