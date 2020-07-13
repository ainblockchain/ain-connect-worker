export type Request = {
  type: 'ADD' | 'EXTEND' | 'TERMINATE'| 'AINIZE',
  publicKey: string;
  serviceId: string;
  price?: number,
  reserveAmount?: number,
}
