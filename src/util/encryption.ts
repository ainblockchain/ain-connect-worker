import * as crypto from 'crypto';
import * as ainUtil from '@ainblockchain/ain-util';

export interface EncryptionHelper {
  CIPHERS: {[cipherName: string]: string};
  createKey: () => Buffer;
  encrypt: (cipherAlg: string, argKey: string| Buffer, text: string) => string;
  decrypt: (cipherAlg: string, argKey: string| Buffer, text: string) => Buffer;
  signatureMessage: (payload: object, publicKey: string, secretKey: string) => SignatureMessage;
}

export interface SignatureMessage {
  payload: object;
  signature: string;
  fields: Array<ainUtil.Field>;
  address: string;
}

const encryptionHelper: EncryptionHelper = (() => {
  const IV_LENGTH = 16;
  const KEY_LENGTH = 32;

  function createKey() {
    return crypto.randomBytes(KEY_LENGTH);
  }

  function encrypt(cipherAlg: string, argKey: string | Buffer, text: string) {
    const iv = crypto.randomBytes(IV_LENGTH);
    let key = Buffer.alloc(KEY_LENGTH);
    key = Buffer.concat([(typeof (argKey) === 'string') ? Buffer.from(argKey) : argKey], key.length);
    const cipher = crypto.createCipheriv(cipherAlg, key, iv);
    let result = cipher.update(text);
    result = Buffer.concat([result, cipher.final()]);
    return `${iv.toString('hex')}:${result.toString('hex')}`;
  }

  function decrypt(cipherAlg: string, argKey: string | Buffer, text: string) {
    let key = Buffer.alloc(KEY_LENGTH);
    key = Buffer.concat([(typeof (argKey) === 'string') ? Buffer.from(argKey) : argKey], key.length);
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as string, 'hex');
    const encryptedText = Buffer.from(textParts[0], 'hex');
    const decipher = crypto.createDecipheriv(cipherAlg, key, iv);
    let result = decipher.update(encryptedText);
    result = Buffer.concat([result, decipher.final()]);
    return result;
  }
  function signatureMessage(payload: object,
    publicKey: string, secretKey: string): SignatureMessage {
    const fields: ainUtil.Field[] = [];
    Object.keys(payload).forEach((name) => {
      fields.push({
        name,
        default: Buffer.from([]),
      });
    });
    console.log(fields);
    const signature = ainUtil.ecSignMessage(
      ainUtil.serialize(payload, fields), ainUtil.toBuffer(secretKey),
    );
    return {
      payload,
      signature,
      fields,
      address: publicKey,
    };
  }

  return {
    CIPHERS: {
      AES_128: 'aes128',
      AES_128_CBC: 'aes-128-cbc',
      AES_192: 'aes192',
      AES_256: 'aes256',
    },
    createKey,
    encrypt,
    decrypt,
    signatureMessage,
  };
})();

export default encryptionHelper;
