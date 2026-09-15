import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InvoiceService } from '../invoice.service.js';
import { Invoice } from '../entities/invoice.entity.js';
import { SubscriptionGuardService } from '../../companies/subscription-guard.service.js';
import { OBJECT_STORAGE } from '../../../ports/object-storage.port.js';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let invoiceRepo: jest.Mocked<Partial<Repository<Invoice>>>;
  let subscriptionGuard: { resolveCompanyId: jest.Mock };
  let objectStorage: { getSignedUrl: jest.Mock };

  beforeEach(async () => {
    invoiceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    subscriptionGuard = {
      resolveCompanyId: jest.fn().mockResolvedValue('company-1'),
    };
    objectStorage = {
      getSignedUrl: jest.fn().mockResolvedValue('https://signed/url'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: OBJECT_STORAGE, useValue: objectStorage },
      ],
    }).compile();

    service = module.get(InvoiceService);
  });

  describe('listForUser', () => {
    it('lists the resolved company invoices newest-first', async () => {
      const rows = [{ id: 'a' }, { id: 'b' }] as Invoice[];
      (invoiceRepo.find as jest.Mock).mockResolvedValue(rows);

      const result = await service.listForUser('user-1');

      expect(subscriptionGuard.resolveCompanyId).toHaveBeenCalledWith('user-1');
      expect(invoiceRepo.find).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        order: { issuedAt: 'DESC' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('getSignedPdfUrl', () => {
    it('returns a signed URL for the company-scoped invoice', async () => {
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        pdfStorageKey: 'invoices/inv-1.pdf',
      });

      const result = await service.getSignedPdfUrl('user-1', 'inv-1');

      expect(invoiceRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'inv-1', companyId: 'company-1' },
      });
      expect(objectStorage.getSignedUrl).toHaveBeenCalledWith(
        'invoices/inv-1.pdf',
      );
      expect(result).toEqual({ url: 'https://signed/url' });
    });

    it('404s when the invoice is not in the caller company', async () => {
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.getSignedPdfUrl('user-1', 'inv-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
