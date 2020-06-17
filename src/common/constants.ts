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
  CLUSTER_DESCRIPTION,
  CLUSTER_GPU_NAME,
  MNEMONIC,
  CONTAINER_IMAGE,
  CONTAINER_OS,
  CONTAINER_APP,
  CONTAINER_LIBRARY,
  CONTAINER_GPU_LIMIT,
  CONTAINER_CPU_LIMIT,
  CONTAINER_STORAGE_LIMIT,
  CONTAINER_MEMORY_LIMIT,
  apiKey,
  authDomain,
  databaseURL,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId,
} = envDev;
export const CLUSTER_DOMAIN = `*.${CLUSTER_NAME}.ainetwork.ai`;
export const PRICE_PER_SECOND = Number(envDev.PRICE_PER_HOUR) / 3600;
export const CONTAINER_COUNT_LIMIT = Number(envDev.CONTAINER_COUNT_LIMIT);

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
  const containerImageRule = /^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+(:[a-zA-Z0-9-]+|)$/;
  const memorySpecRule = /^[0-9]+(Ei|Pi|Ti|Gi|Mi|Ki)+$/;
  const cpuSpecRule = /^[0-9]+(.[0-9]+|)$/;
  const gpuSpecRule = /^[0-9]+$/;
  const storageSpecRule = /^[0-9]+(Ei|Pi|Ti|Gi|Mi|Ki)+$/;

  const result = (CLUSTER_NAME && clusterNamingRule.test(CLUSTER_NAME))
    && (CLUSTER_DESCRIPTION && CONTAINER_OS && CONTAINER_APP && CONTAINER_LIBRARY)
    && (VERSION && SERVER_ADDR && CLUSTER_GPU_NAME)
    && (MNEMONIC && MNEMONIC.split(' ').length === 12)
    && (CONTAINER_IMAGE && containerImageRule.test(CONTAINER_IMAGE))
    && (CONTAINER_GPU_LIMIT && gpuSpecRule.test(CONTAINER_GPU_LIMIT))
    && (CONTAINER_CPU_LIMIT && cpuSpecRule.test(CONTAINER_CPU_LIMIT))
    && (CONTAINER_STORAGE_LIMIT && storageSpecRule.test(CONTAINER_STORAGE_LIMIT))
    && (CONTAINER_MEMORY_LIMIT && memorySpecRule.test(CONTAINER_MEMORY_LIMIT))
    && (CONTAINER_COUNT_LIMIT && !Number.isNaN(CONTAINER_COUNT_LIMIT))
    && (!Number.isNaN(PRICE_PER_SECOND));

  if (!result) {
    throw Error('<constants> invalid constants');
  }
};
