import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookController } from '../webhook.controller.js';
import { WebhookService } from '../webhook.service.js';

describe('WebhookController', () => {
  let controller: WebhookController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      processWebhook: jest.fn().mockResolvedValue({
        alreadyProcessed: false,
        scoreId: 'score-1',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: WebhookService, useValue: service }],
    }).compile();

    controller = module.get(WebhookController);
  });

  describe('handleWebhook', () => {
    const rawBodyBuffer = Buffer.from('{"externalId":"ext-123"}');
    const signature = 'valid-sig';

    function makeRequest(rawBody: Buffer | undefined): RawBodyRequest<Request> {
      return { rawBody } as RawBodyRequest<Request>;
    }

    it('should pass the raw request body and signature to the service', async () => {
      await controller.handleWebhook(makeRequest(rawBodyBuffer), signature);

      expect(service.processWebhook).toHaveBeenCalledWith(
        rawBodyBuffer,
        signature,
      );
    });

    it('should return processed result', async () => {
      const result = await controller.handleWebhook(
        makeRequest(rawBodyBuffer),
        signature,
      );

      expect(result.alreadyProcessed).toBe(false);
      expect(result.scoreId).toBe('score-1');
    });

    it('should return 200 even for idempotent replay', async () => {
      service.processWebhook.mockResolvedValue({
        alreadyProcessed: true,
        scoreId: 'score-1',
      });

      const result = await controller.handleWebhook(
        makeRequest(rawBodyBuffer),
        signature,
      );

      expect(result.alreadyProcessed).toBe(true);
    });

    it('should reject when the raw body was not captured', async () => {
      await expect(
        controller.handleWebhook(makeRequest(undefined), signature),
      ).rejects.toThrow(BadRequestException);

      expect(service.processWebhook).not.toHaveBeenCalled();
    });

    it('should not require JWT authentication', () => {
      const controllerProto = Object.getPrototypeOf(controller);
      const metadata = Reflect.getMetadata(
        '__guards__',
        controllerProto.constructor,
      );
      expect(metadata).toBeUndefined();
    });
  });
});
