import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as ainUtil from '@ainblockchain/ain-util';
import { mnemonicToSeedSync } from 'bip39';

const HDKey = require('hdkey');

// Default Config
const envDev = dotenv.parse(fs.readFileSync('./.env'));
export const {
  VERSION,
  SERVER_ADDR,
  INSTANCE_IMAGE,
  apiKey,
  authDomain,
  databaseURL,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId,
} = envDev;

export const firebaseConfig = {
  apiKey,
  authDomain,
  databaseURL,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId,
};

// Worker Config
export const {
  WORKER_NAME,
  DESCRIPTION,
  MNEMONIC,
  FIREBASE_EMAIL,
  FIREBASE_PWD,
} = process.env;
export const PRICE = Number(process.env.PRICE) / 3600;
export const MAX_SERVICE_COUNT = Number(process.env.MAX_INSTANCE_COUNT) || 5;

const key = HDKey.fromMasterSeed(mnemonicToSeedSync(MNEMONIC!));
const mainWallet = key.derive("m/44'/412'/0'/0/0"); /* default wallet address for AIN */
export const SECRET_KEY = `0x${mainWallet.privateKey.toString('hex')}`;
export const WORKER_ADDR = `0x${ainUtil.pubToAddress(mainWallet.publicKey, true).toString('hex')}`;
export const WORKER_KEY = `${WORKER_ADDR}/${WORKER_NAME}`;

export const ERROR_MESSAGE = {
  500: 'failed to start',
  510: 'failed to terminate',
  520: 'failed to extend',
  530: 'invalid parameter',
};
