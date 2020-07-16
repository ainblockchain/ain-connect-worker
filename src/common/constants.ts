import * as ainUtil from '@ainblockchain/ain-util';
import { mnemonicToSeedSync } from 'bip39';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const HDKey = require('hdkey');

let envDev = dotenv.parse(fs.readFileSync(`./.env${(process.env.NODE_ENV) ? `.${process.env.NODE_ENV}` : ''}`));
envDev = {
  ...envDev,
  ...JSON.parse(JSON.stringify(process.env)),
};

// Cluster Config
export const {
  VERSION,
  SERVER_ADDR,
  CLUSTER_NAME,
  MNEMONIC,
  apiKey,
  authDomain,
  databaseURL,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId,
} = envDev;
export const CONTAINER_COUNT_LIMIT = Number(envDev.CONTAINER_COUNT_LIMIT);
export const ALLOW_PK_LIST = (envDev.ALLOW_PK_LIST || '').split(' ');

const key = HDKey.fromMasterSeed(mnemonicToSeedSync(MNEMONIC!));
const mainWallet = key.derive("m/44'/412'/0'/0/0"); /* default wallet address for AIN */
export const SECRET_KEY = `0x${mainWallet.privateKey.toString('hex')}`;
export const CLUSTER_ADDR = ainUtil.toChecksumAddress(`0x${ainUtil.pubToAddress(mainWallet.publicKey, true).toString('hex')}`);
export const CLUSTER_KEY = `${CLUSTER_ADDR}@${CLUSTER_NAME}`;

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

// Container
export const HEALTH_PORT = 8000;

// Tracker
export const TRACKER_HEALTH_MS = 5000;

// Manager
export const INTERVAL_MS = 600000;

export const checkConstants = async () => {
  const clusterNamingRule = /^[a-zA-Z0-9-]*.{2,63}$/;

  const result = (CLUSTER_NAME && clusterNamingRule.test(CLUSTER_NAME)
    && (VERSION && SERVER_ADDR)
    && (MNEMONIC && MNEMONIC.split(' ').length === 12)
  );

  if (!result) {
    throw Error('<constants> invalid constants');
  }
};
