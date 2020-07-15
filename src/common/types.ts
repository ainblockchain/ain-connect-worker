export type Request = {
  type: 'AINIZE',
  publicKey: string;
  serviceId: string;
  price?: number,
  reserveAmount?: number,
}
