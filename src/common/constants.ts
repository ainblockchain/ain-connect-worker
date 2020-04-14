import * as ainUtil from '@ainblockchain/ain-util';
import { mnemonicToSeedSync } from 'bip39';

const HDKey = require('hdkey');

const envDev = (process.env.NODE_ENV === 'prod') ? {
  // prod
  VERSION: '1.0.0',
  SERVER_ADDR: 'server.ainetwork.ai',
  apiKey: 'AIzaSyA5kRVMdA0epW5MUZJoC7shC-bLjqnxt-0',
  authDomain: 'ain-v1-manager-prod.firebaseapp.com',
  databaseURL: 'https://ain-v1-manager-prod.firebaseio.com',
  projectId: 'ain-v1-manager-prod',
  storageBucket: 'ain-v1-manager-prod.appspot.com',
  messagingSenderId: '1072880050549',
  appId: '1:1072880050549:web:9d914b8ed6bc5686e2f33c',
  measurementId: 'G-K3VZW4V0PR',
} : {
  // staging
  VERSION: '1.0.0',
  SERVER_ADDR: 'staging.server.ainetwork.ai',
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
  IMAGE,
  GPU_LIMIT,
  CPU_LIMIT_m,
  MEMORY_LIMIT_Mi,
  STORAGE_LIMIT_Gi,
} = process.env;
export const PRICE = Number(process.env.PRICE) / 3600;
export const MAX_CONTAINER_COUNT = Number(process.env.MAX_CONTAINER_COUNT) || 5;
export const CONTAINER_IMAGE = IMAGE;

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
  540: 'not ready',
  550: 'already exists',
  600: 'Unexpected Error',
};


// Tracker
export const TRACKER_HEALTH_MS = 5000;

// Manager
export const INTERVAL_MS = 60000;

// temp
export const DOMAIN = `*.${CLUSTER_NAME}.ainetwork.ai`;

export const checkConstants = async () => {
  const clusterNamingRule = /^[a-zA-Z0-9-]*$/;
  const result = (CLUSTER_NAME && clusterNamingRule.test(CLUSTER_NAME)
    && CLUSTER_NAME.length > 2 && CLUSTER_NAME.length < 63)
    && (MNEMONIC && IMAGE && DESCRIPTION)
    && (STORAGE_LIMIT_Gi && !Number.isNaN(Number(STORAGE_LIMIT_Gi)))
    && (PRICE && !Number.isNaN(Number(PRICE)));

  if (!result) {
    throw Error('<constants> invalid constants');
  }
};
