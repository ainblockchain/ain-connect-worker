export type Request = {
  type: 'ADD' | 'EXTEND' | 'TERMINATE',
  publicKey: string;
  serviceId: string;
  price?: number,
  reserveAmount?: number,
}
