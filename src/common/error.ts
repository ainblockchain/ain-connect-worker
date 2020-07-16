export const enum STATUS_CODE {
  success = '0',
  invalidParams = '2',
  callError = '7',
  Unexpected = '500',
}

export const errorCategoryInfo = {
  // Tracker
  registerTracker: 'Failed to register',
  // Manager
  runCommand: 'Failed to run',
  startManager: 'Failed to listen to Firestore',
  eventManager: 'Event Error',
};

export const errorMessage = {
  2: 'It is invalid parameter.',
  7: 'Failed to call functions',
  500: 'It is unexpected result.',
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
