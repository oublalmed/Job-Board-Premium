import { JwtStrategy } from '../strategies/jwt.strategy.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };
    strategy = new JwtStrategy(configService as any);
  });

  it('should return the JWT payload from validate', () => {
    const payload = {
      sub: 'user-1',
      email: 'test@example.com',
      roles: [Role.CANDIDATE],
    };

    const result = strategy.validate(payload);

    expect(result).toEqual({
      sub: 'user-1',
      email: 'test@example.com',
      roles: [Role.CANDIDATE],
    });
  });
});
