import { Test, TestingModule } from '@nestjs/testing';
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
    const rawBody = Buffer.from('{"externalId":"ext-123"}');
    const signature = 'valid-sig';

    it('should pass raw body and signature to service', async () => {
      await controller.handleWebhook(rawBody, signature);

      expect(service.processWebhook).toHaveBeenCalledWith(rawBody, signature);
    });

    it('should return processed result', async () => {
      const result = await controller.handleWebhook(rawBody, signature);

      expect(result.alreadyProcessed).toBe(false);
      expect(result.scoreId).toBe('score-1');
    });

    it('should return 200 even for idempotent replay', async () => {
      service.processWebhook.mockResolvedValue({
        alreadyProcessed: true,
        scoreId: 'score-1',
      });

      const result = await controller.handleWebhook(rawBody, signature);

      expect(result.alreadyProcessed).toBe(true);
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
