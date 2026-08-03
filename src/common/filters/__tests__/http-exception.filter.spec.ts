import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../http-exception.filter.js';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/test' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException(
      { message: 'Not found', error: 'Not Found' },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Not found',
        path: '/test',
      }),
    );
  });

  it('should handle HttpException with string response', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Forbidden',
      }),
    );
  });

  it('should handle non-HttpException as 500', () => {
    filter.catch(new Error('unexpected'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      }),
    );
  });

  it('should handle non-Error exception as 500', () => {
    filter.catch('string error', mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
      }),
    );
  });

  it('should pass through extra structured fields from the exception body', () => {
    const exception = new HttpException(
      { message: 'Cooldown active', reEligibleAt: '2026-10-30T00:00:00.000Z' },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Cooldown active',
        reEligibleAt: '2026-10-30T00:00:00.000Z',
      }),
    );
  });

  it('never lets an extra field shadow the derived statusCode/error/message/path', () => {
    const exception = new HttpException(
      {
        message: 'real message',
        statusCode: 999,
        error: 'Fake',
        path: '/fake',
        timestamp: 'fake',
      },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'real message',
        path: '/test',
      }),
    );
  });

  it('should include timestamp and path', () => {
    filter.catch(new HttpException('test', 400), mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/test',
        timestamp: expect.any(String),
      }),
    );
  });
});
