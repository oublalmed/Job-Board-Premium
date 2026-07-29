export interface ContactQuotaPort {
  consumeOneContact(companyId: string): Promise<void>;
}

export const CONTACT_QUOTA_PORT = Symbol('CONTACT_QUOTA_PORT');
