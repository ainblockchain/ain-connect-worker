import * as ainUtil from '@ainblockchain/ain-util';
import { mnemonicToSeedSync } from 'bip39';

const HDKey = require('hdkey');


const envDev = (process.env.NODE_ENV === 'prod') ? {
  // prod
  VERSION: '1.0.0',
  SERVER_ADDR: 'staging.server.ainetwork.ai',
  INSTANCE_IMAGE: 'ainblockchain/ain-connect-shell-staging:latest',
  apiKey: 'AIzaSyBXiSjPItO-3Oj5ibPTJQXgxfVZUsgo5YI',
  authDomain: 'ain-v1-manager-staging.firebaseapp.com',
  databaseURL: 'https://ain-v1-manager-staging.firebaseio.com',
  projectId: 'ain-v1-manager-staging',
  storageBucket: 'ain-v1-manager-staging.appspot.com',
  messagingSenderId: '222638069988',
  appId: '1:222638069988:web:d66c87762bb56e2aaa74f1',
  measurementId: 'G-L87MHFHMJJ',
} : {
  // staging
  VERSION: '1.0.0',
  SERVER_ADDR: 'staging.server.ainetwork.ai',
  INSTANCE_IMAGE: 'ainblockchain/ain-connect-shell-staging:latest',
  apiKey: 'AIzaSyBXiSjPItO-3Oj5ibPTJQXgxfVZUsgo5YI',
  authDomain: 'ain-v1-manager-staging.firebaseapp.com',
  databaseURL: 'https://ain-v1-manager-staging.firebaseio.com',
  projectId: 'ain-v1-manager-staging',
  storageBucket: 'ain-v1-manager-staging.appspot.com',
  messagingSenderId: '222638069988',
  appId: '1:222638069988:web:d66c87762bb56e2aaa74f1',
  measurementId: 'G-L87MHFHMJJ',
};

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

// Cluster Config
export const {
  CLUSTER_NAME,
  DESCRIPTION,
  MNEMONIC,
} = process.env;
export const PRICE = Number(process.env.PRICE) / 3600;
export const MAX_CONTAINER_COUNT = Number(process.env.MAX_CONTAINER_COUNT) || 5;

const key = HDKey.fromMasterSeed(mnemonicToSeedSync(MNEMONIC!));
const mainWallet = key.derive("m/44'/412'/0'/0/0"); /* default wallet address for AIN */
export const SECRET_KEY = `0x${mainWallet.privateKey.toString('hex')}`;
export const CLUSTER_ADDR = ainUtil.toChecksumAddress(`0x${ainUtil.pubToAddress(mainWallet.publicKey, true).toString('hex')}`);
export const CLUSTER_KEY = `${CLUSTER_ADDR}@${CLUSTER_NAME}`;

export const ERROR_MESSAGE = {
  500: 'failed to start',
  510: 'failed to terminate',
  520: 'failed to extend',
  530: 'invalid parameter',
};
